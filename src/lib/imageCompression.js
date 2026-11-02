/**
 * Compress and resize images for upload
 * @param {File} file - The image file to compress
 * @param {Object} options - Compression options
 * @param {boolean} options.generateThumbnail - Whether to generate thumbnail (default: false)
 * @returns {Promise<{compressed: string, thumbnail?: string}>}
 */
export async function compressImage(file, options = {}) {
  const {
    maxWidth = 800,
    maxHeight = 800,
    quality = 0.85,
    thumbnailSize = 200,
    generateThumbnail = false,
  } = options;

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onerror = () => reject(new Error("Erro ao ler o arquivo"));
    
    reader.onload = (e) => {
      const img = new Image();
      
      img.onerror = () => reject(new Error("Erro ao carregar a imagem"));
      
      img.onload = () => {
        try {
          // Generate compressed version
          const compressed = resizeImage(img, maxWidth, maxHeight, quality);
          
          const result = { compressed };
          
          // Generate thumbnail only if requested
          if (generateThumbnail) {
            result.thumbnail = resizeImage(img, thumbnailSize, thumbnailSize, quality);
          }
          
          resolve(result);
        } catch (error) {
          reject(error);
        }
      };
      
      img.src = e.target.result;
    };
    
    reader.readAsDataURL(file);
  });
}

/**
 * Resize image to fit within max dimensions while maintaining aspect ratio
 * @param {HTMLImageElement} img - Source image
 * @param {number} maxWidth - Maximum width
 * @param {number} maxHeight - Maximum height
 * @param {number} quality - JPEG quality (0-1)
 * @returns {string} Data URL of resized image
 */
function resizeImage(img, maxWidth, maxHeight, quality) {
  let width = img.width;
  let height = img.height;

  // Calculate new dimensions maintaining aspect ratio
  if (width > height) {
    if (width > maxWidth) {
      height = Math.round((height * maxWidth) / width);
      width = maxWidth;
    }
  } else {
    if (height > maxHeight) {
      width = Math.round((width * maxHeight) / height);
      height = maxHeight;
    }
  }

  // Create canvas and draw resized image
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext("2d");
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(img, 0, 0, width, height);

  // Convert to data URL
  return canvas.toDataURL("image/jpeg", quality);
}

/**
 * Get image dimensions from file
 * @param {File} file - Image file
 * @returns {Promise<{width: number, height: number}>}
 */
export async function getImageDimensions(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onerror = () => reject(new Error("Erro ao ler o arquivo"));
    
    reader.onload = (e) => {
      const img = new Image();
      
      img.onerror = () => reject(new Error("Erro ao carregar a imagem"));
      
      img.onload = () => {
        resolve({ width: img.width, height: img.height });
      };
      
      img.src = e.target.result;
    };
    
    reader.readAsDataURL(file);
  });
}
