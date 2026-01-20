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
  
  const containerRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const dragStartRef = useRef({ x: 0, y: 0 });
  const imgStartPosRef = useRef({ x: 0, y: 0 });

  // Kezdeti középre igazítás
  const onImageLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const img = e.currentTarget;
    const container = containerRef.current;
    if (container) {
      // Kiszámoljuk, hogy középen legyen
      const x = (container.clientWidth - img.width) / 2;
      const y = (container.clientHeight - img.height) / 2;
      setPosition({ x, y });
    }
  };

  // Mozgatás (Drag) kezelése
  const handlePointerDown = (e: React.PointerEvent) => {
    e.preventDefault(); // Megakadályozza a kép kijelölését
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

  // Mentés és Vágás
  const handleSave = async () => {
    if (!imageRef.current || !containerRef.current) return;
    setIsProcessing(true);

    try {
      // Itt történik a matek: Megnézzük, hol van a kép a képernyőn (rect)
      // és hol van a vágókeret (containerRect).
      const imageRect = imageRef.current.getBoundingClientRect();
      const containerRect = containerRef.current.getBoundingClientRect();

      // Kiszámoljuk a relatív pozíciót és méretezést
      const scaleX = imageRef.current.naturalWidth / imageRect.width;
      const scaleY = imageRef.current.naturalHeight / imageRect.height;

      // A vágási terület a containerRect a képen belül
      const pixelCrop = {
        x: (containerRect.left - imageRect.left) * scaleX,
        y: (containerRect.top - imageRect.top) * scaleY,
        width: containerRect.width * scaleX,
        height: containerRect.height * scaleY,
      };

      // Meghívjuk a tömörítő függvényt
      const croppedFile = await getCroppedImg(imageSrc, pixelCrop);
      onCropComplete(croppedFile);
    } catch (e) {
      console.error(e);
      setIsProcessing(false);
    }
  };

  return (
    <div className={styles.container}>
      <h3 className={styles.title}>Profilkép beállítása</h3>
      
      {/* Vágóterület (A Kör) */}
      <div className={styles.cropAreaWrapper}>
        <div className={styles.cropContainer} ref={containerRef}>
          <img
            ref={imageRef}
            src={imageSrc}
            alt="Crop target"
            className={styles.image}
            style={{
              transform: `translate(${position.x}px, ${position.y}px) scale(${zoom})`,
              cursor: isDragging ? 'grabbing' : 'grab'
            }}
            onLoad={onImageLoad}
            onPointerDown={handlePointerDown}
            draggable={false}
          />
        </div>
        {/* Sötétítő maszk a körön kívül */}
        <div className={styles.overlay}></div>
      </div>
      
      <div className={styles.controls}>
        <p className={styles.hint}>Húzd a képet a mozgatáshoz</p>
        
        <div className={styles.sliderContainer}>
          <span className={styles.sliderLabel}>−</span>
          <input
            type="range"
            value={zoom}
            min={0.5}
            max={3}
            step={0.1}
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
