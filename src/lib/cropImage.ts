// Segédfüggvény a kép betöltéséhez
export const createImage = (url: string): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const image = new Image();
    image.addEventListener('load', () => resolve(image));
    image.addEventListener('error', (error) => reject(error));
    image.setAttribute('crossOrigin', 'anonymous'); // Fontos a CORS miatt
    image.src = url;
  });

/**
 * Ez a függvény végzi a kivágást és a tömörítést.
 * @param imageSrc - A forráskép URL-je (vagy base64)
 * @param pixelCrop - A kivágandó terület koordinátái (x, y, width, height)
 */
export default async function getCroppedImg(
  imageSrc: string,
  pixelCrop: { x: number; y: number; width: number; height: number }
): Promise<File> {
  const image = await createImage(imageSrc);
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');

  if (!ctx) {
    throw new Error('No 2d context');
  }

  // 1. A vászon mérete legyen a kivágott terület mérete
  canvas.width = pixelCrop.width;
  canvas.height = pixelCrop.height;

  // 2. Rárajzoljuk a képet a megfelelő eltolással
  ctx.drawImage(
    image,
    pixelCrop.x,
    pixelCrop.y,
    pixelCrop.width,
    pixelCrop.height,
    0,
    0,
    pixelCrop.width,
    pixelCrop.height
  );

  // 3. Tömörítés és Átméretezés
  // Ha a kivágott kép nagyobb mint 500x500, lekicsinyítjük
  const maxSize = 500;
  let finalCanvas = canvas;
  
  if (pixelCrop.width > maxSize || pixelCrop.height > maxSize) {
    const resizedCanvas = document.createElement('canvas');
    resizedCanvas.width = maxSize;
    resizedCanvas.height = maxSize;
    const resizedCtx = resizedCanvas.getContext('2d');
    
    if (resizedCtx) {
      // Magas minőségű átméretezés
      resizedCtx.drawImage(canvas, 0, 0, maxSize, maxSize);
      finalCanvas = resizedCanvas;
    }
  }

  // 4. Blob-bá (fájllá) alakítás WebP formátumban (kisebb méret)
  return new Promise((resolve, reject) => {
    finalCanvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error('Canvas is empty'));
          return;
        }
        // Fájl objektum létrehozása WebP formátumban
        const file = new File([blob], 'avatar.webp', { type: 'image/webp' });
        resolve(file);
      },
      'image/webp', // WebP használata
      0.75 // Minőség: 75% (elég jó minőség, kis méret)
    );
  });
}
