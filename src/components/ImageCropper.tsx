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

  // Reseteljük a pozíciót, ha új kép jön
  useEffect(() => {
    setPosition({ x: 0, y: 0 });
    setZoom(1);
  }, [imageSrc]);

  // Mozgatás (Drag) kezelése - Egér és Érintés
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
      
      // Korlátozzuk a mozgást, hogy ne lehessen kitolni a képet a végtelenségbe
      // (Ez opcionális finomhangolás, egyelőre engedjük a szabad mozgást)
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

      // Kiszámoljuk a relatív pozíciót és méretezést
      // Mivel object-fit: contain/cover-t használhat a böngésző, 
      // a naturalWidth/Height arányát kell nézni a megjelenített mérethez képest.
      
      const scaleX = imageRef.current.naturalWidth / imageRect.width;
      const scaleY = imageRef.current.naturalHeight / imageRect.height;

      // A vágási terület:
      // (Konténer bal széle - Kép bal széle) * Arány
      const pixelCrop = {
        x: (containerRect.left - imageRect.left) * scaleX,
        y: (containerRect.top - imageRect.top) * scaleY,
        width: containerRect.width * scaleX,
        height: containerRect.height * scaleY,
      };

      // Védelmi mechanizmus: Ha negatív koordináták jönnének ki (kilóg a kép),
      // akkor korrigáljuk 0-ra, hogy ne legyen hiba a Canvas rajzolásnál.
      if (pixelCrop.x < 0) pixelCrop.x = 0;
      if (pixelCrop.y < 0) pixelCrop.y = 0;

      const croppedFile = await getCroppedImg(imageSrc, pixelCrop);
      onCropComplete(croppedFile);
    } catch (e) {
      console.error("Hiba a vágásnál:", e);
      setIsProcessing(false);
      // Opcionális: jelezhetnénk a hibát a felhasználónak
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
              // A translate mozgatja a képet, a scale nagyítja
              // Fontos: a transform-origin most 'center', így középről nagyít
              transform: `translate(${position.x}px, ${position.y}px) scale(${zoom})`,
              cursor: isDragging ? 'grabbing' : 'grab'
            }}
            onPointerDown={handlePointerDown}
            draggable={false}
          />
        </div>
        {/* Sötétítő maszk a körön kívül (CSS box-shadow trükk) */}
      </div>
      
      <div className={styles.controls}>
        <p className={styles.hint}>Húzd a képet a mozgatáshoz</p>
        
        <div className={styles.sliderContainer}>
          <span className={styles.sliderLabel}>−</span>
          <input
            type="range"
            value={zoom}
            min={0.5} // Kicsit kisebbre is lehessen venni
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
