import { v2 as cloudinary } from "cloudinary";
import { env } from "../config/env";
import { AppError } from "../utils/app-error";

const cloudinaryConfigured = Boolean(env.CLOUDINARY_URL);

if (cloudinaryConfigured) {
  process.env.CLOUDINARY_URL = env.CLOUDINARY_URL;
  cloudinary.config({
    secure: true
  });
}

export async function uploadImageBuffer(buffer: Buffer, folder: string) {
  if (!cloudinaryConfigured) {
    throw new AppError(
      "Cloudinary nao configurado. Defina CLOUDINARY_URL para habilitar uploads.",
      500
    );
  }

  return new Promise<{ url: string; publicId: string }>((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder,
        resource_type: "image"
      },
      (error, result) => {
        if (error || !result) {
          reject(new AppError("Falha no upload da imagem", 500));
          return;
        }

        resolve({
          url: result.secure_url,
          publicId: result.public_id
        });
      }
    );

    stream.end(buffer);
  });
}

export async function deleteCloudinaryImage(publicId?: string | null) {
  if (!publicId || !cloudinaryConfigured) {
    return;
  }

  await cloudinary.uploader.destroy(publicId);
}
