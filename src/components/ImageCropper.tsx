import { useState, useRef, useEffect } from 'react';
import { Button } from './ui';
import getCroppedImg from '../lib/cropImage';
import styles from './ImageCropper.module.css';

interface ImageCropperProps {
  imageSrc: string;
  onCancel: () => void;
  onCropComplete: (file: File) => void;
}

export function ImageCropper({ imageSrc, onCancel, onCropComplete }: ImageCropperProps) {
  const [zoom, setZoom] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  
  // ÚJ: Tároljuk a kép kezdő stílusát (hogy illeszkedjen a dobozba)
  const [baseStyle, setBaseStyle] = useState<React.CSSProperties>({});
  
  const containerRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const dragStartRef = useRef({ x: 0, y: 0 });
  const imgStartPosRef = useRef({ x: 0, y: 0 });

  // 1. Amikor a kép betölt, beállítjuk a méretét, hogy pont beleférjen
  const onImageLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const img = e.currentTarget;
    const { naturalWidth, naturalHeight } = img;
    
    // Alapértelmezett reset
    setPosition({ x: 0, y: 0 });
    setZoom(1);

    // Döntés: Álló vagy Fekvő kép?
    // Ha a kép aránya szélesebb, mint 1 (fekvő), akkor a magasságát igazítjuk a körhöz (100%).
    // Ha a kép aránya magasabb (álló), akkor a szélességét igazítjuk a körhöz (100%).
    if (naturalWidth / naturalHeight > 1) {
      // Fekvő kép -> Magasság legyen a fix, szélesség automatikus
      setBaseStyle({ height: '100%', width: 'auto' });
    } else {
      // Álló kép (vagy négyzet) -> Szélesség legyen fix, magasság automatikus
      setBaseStyle({ width: '100%', height: 'auto' });
    }
  };

  // Mozgatás (Drag) kezelése
  const handlePointerDown = (e: React.PointerEvent) => {
    e.preventDefault();
    setIsDragging(true);
    dragStartRef.current = { x: e.clientX, y: e.clientY };
    imgStartPosRef.current = { ...position };
  };

  useEffect(() => {
    const handlePointerMove = (e: PointerEvent) => {
      if (!isDragging) return;
      
      const dx = e.clientX - dragStartRef.current.x;
      const dy = e.clientY - dragStartRef.current.y;
      
      setPosition({
        x: imgStartPosRef.current.x + dx,
        y: imgStartPosRef.current.y + dy
      });
    };

    const handlePointerUp = () => {
      setIsDragging(false);
    };

    if (isDragging) {
      window.addEventListener('pointermove', handlePointerMove);
      window.addEventListener('pointerup', handlePointerUp);
    }

    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };
  }, [isDragging]);

  const handleSave = async () => {
    if (!imageRef.current || !containerRef.current) return;
    setIsProcessing(true);

    try {
      const imageRect = imageRef.current.getBoundingClientRect();
      const containerRect = containerRef.current.getBoundingClientRect();

      // Kiszámoljuk a relatív skálázást a renderelt méret és az eredeti méret között
      const scaleX = imageRef.current.naturalWidth / imageRect.width;
      const scaleY = imageRef.current.naturalHeight / imageRect.height;

      // A vágási terület kiszámítása
      const pixelCrop = {
        x: (containerRect.left - imageRect.left) * scaleX,
        y: (containerRect.top - imageRect.top) * scaleY,
        width: containerRect.width * scaleX,
        height: containerRect.height * scaleY,
      };

      // Biztonsági korrekció (negatív értékek elkerülése)
      if (pixelCrop.x < 0) pixelCrop.x = 0;
      if (pixelCrop.y < 0) pixelCrop.y = 0;

      const croppedFile = await getCroppedImg(imageSrc, pixelCrop);
      onCropComplete(croppedFile);
    } catch (e) {
      console.error("Hiba a vágásnál:", e);
      setIsProcessing(false);
    }
  };

  return (
    <div className={styles.container}>
      <h3 className={styles.title}>Profilkép beállítása</h3>
      
      <div className={styles.cropAreaWrapper}>
        <div className={styles.cropContainer} ref={containerRef}>
          <img
            ref={imageRef}
            src={imageSrc}
            alt="Crop target"
            className={styles.image}
            style={{
              ...baseStyle, // Itt alkalmazzuk a kiszámolt alapméretet
              transform: `translate(${position.x}px, ${position.y}px) scale(${zoom})`,
              cursor: isDragging ? 'grabbing' : 'grab'
            }}
            onLoad={onImageLoad}
            onPointerDown={handlePointerDown}
            draggable={false}
          />
        </div>
      </div>
      
      <div className={styles.controls}>
        <p className={styles.hint}>Húzd a képet a mozgatáshoz</p>
        
        <div className={styles.sliderContainer}>
          <span className={styles.sliderLabel}>−</span>
          <input
            type="range"
            value={zoom}
            min={0.5} // Kicsit engedjük kisebbre is venni
            max={3}
            step={0.05}
            onChange={(e) => setZoom(Number(e.target.value))}
            className={styles.slider}
          />
          <span className={styles.sliderLabel}>+</span>
        </div>
        
        <div className={styles.buttons}>
          <Button variant="ghost" onClick={onCancel} disabled={isProcessing}>
            Mégse
          </Button>
          <Button onClick={handleSave} disabled={isProcessing}>
            {isProcessing ? 'Mentés...' : 'Kész'}
          </Button>
        </div>
      </div>
    </div>
  );
}
