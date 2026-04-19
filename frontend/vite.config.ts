import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173
  },
  build: {
    // Gera chunks separados para cada rota — reduz o bundle inicial carregado pelo visitante
    rollupOptions: {
      output: {
        manualChunks: {
          "vendor-react": ["react", "react-dom", "react-router-dom"],
          "vendor-ui": ["lucide-react", "clsx"],
          "vendor-http": ["axios"]
        }
      }
    },
    // Alerta apenas quando chunk > 500kb
    chunkSizeWarningLimit: 500
  }
});
