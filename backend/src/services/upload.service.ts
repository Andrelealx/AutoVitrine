import sharp from "sharp";
import { env } from "../config/env";
import { logger } from "../config/logger";
import { AppError } from "../utils/app-error";

// Comprime a imagem antes do upload para economizar Cloudinary e largura de banda
async function compressImage(buffer: Buffer): Promise<Buffer> {
  try {
    return await sharp(buffer)
      .resize({ width: 1600, height: 1200, fit: "inside", withoutEnlargement: true })
      .jpeg({ quality: 82, progressive: true })
      .toBuffer();
  } catch {
    // Se o sharp falhar (ex: formato não suportado), usa o buffer original
    return buffer;
  }
}

type CloudinaryV2 = typeof import("cloudinary")["v2"];

const cloudinaryUrl = env.CLOUDINARY_URL?.trim();
const hasUrlConfig = Boolean(cloudinaryUrl && cloudinaryUrl.startsWith("cloudinary://"));
const hasExplicitConfig = Boolean(
  env.CLOUDINARY_CLOUD_NAME && env.CLOUDINARY_API_KEY && env.CLOUDINARY_API_SECRET
);
const cloudinaryConfigured = hasUrlConfig || hasExplicitConfig;

let cloudinary: CloudinaryV2 | null = null;

function getCloudinary() {
  if (!cloudinaryConfigured) {
    throw new AppError(
      "Cloudinary nao configurado. Defina CLOUDINARY_URL ou CLOUDINARY_CLOUD_NAME/CLOUDINARY_API_KEY/CLOUDINARY_API_SECRET.",
      500
    );
  }

  if (cloudinary) {
    return cloudinary;
  }

  try {
    if (hasExplicitConfig) {
      delete process.env.CLOUDINARY_URL;
      const cloudinaryModule = require("cloudinary") as typeof import("cloudinary");
      cloudinary = cloudinaryModule.v2;
      cloudinary.config({
        cloud_name: env.CLOUDINARY_CLOUD_NAME,
        api_key: env.CLOUDINARY_API_KEY,
        api_secret: env.CLOUDINARY_API_SECRET,
        secure: true
      });
      return cloudinary;
    }

    process.env.CLOUDINARY_URL = cloudinaryUrl;
    const cloudinaryModule = require("cloudinary") as typeof import("cloudinary");
    cloudinary = cloudinaryModule.v2;
    cloudinary.config({ secure: true });
    return cloudinary;
  } catch (error: any) {
    logger.error("Falha ao inicializar Cloudinary", {
      message: error?.message
    });
    throw new AppError(`Configuracao do Cloudinary invalida: ${error?.message || "erro desconhecido"}`, 500);
  }
}

export async function uploadImageBuffer(buffer: Buffer, folder: string) {
  const cloudinaryClient = getCloudinary();
  const compressed = await compressImage(buffer);

  return new Promise<{ url: string; publicId: string }>((resolve, reject) => {
    const stream = cloudinaryClient.uploader.upload_stream(
      {
        folder,
        resource_type: "image"
      },
      (error, result) => {
        if (error || !result) {
          reject(new AppError(`Falha no upload da imagem: ${error?.message || "erro desconhecido"}`, 500));
          return;
        }

        resolve({
          url: result.secure_url,
          publicId: result.public_id
        });
      }
    );

    stream.end(compressed);
  });
}

export async function deleteCloudinaryImage(publicId?: string | null) {
  if (!publicId || !cloudinaryConfigured) {
    return;
  }

  const cloudinaryClient = getCloudinary();
  await cloudinaryClient.uploader.destroy(publicId);
}
