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
  const [baseStyle, setBaseStyle] = useState<React.CSSProperties>({});
  
  // Refek a méretezéshez
  const cropGuideRef = useRef<HTMLDivElement>(null); // Ez a fehér kör (overlay)
  const imageRef = useRef<HTMLImageElement>(null);
  
  const dragStartRef = useRef({ x: 0, y: 0 });
  const imgStartPosRef = useRef({ x: 0, y: 0 });

  // 1. Kép betöltésekor igazítás
  const onImageLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const img = e.currentTarget;
    const { naturalWidth, naturalHeight } = img;
    
    setPosition({ x: 0, y: 0 });
    setZoom(1);

    // Ha fekvő kép: magasság legyen 100%, szélesség auto
    // Ha álló kép: szélesség legyen 100%, magasság auto
    // Így pont kitölti a keretet (vagy kicsit nagyobb)
    if (naturalWidth / naturalHeight > 1) {
      setBaseStyle({ height: '280px', width: 'auto' }); // 280px a kör mérete a CSS-ben
    } else {
      setBaseStyle({ width: '280px', height: 'auto' });
    }
  };

  // 2. Mozgatás kezelése (A teljes wrapperen figyeljük)
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

  // 3. Zoom gombok logikája
  const handleZoomIn = () => setZoom(prev => Math.min(3, prev + 0.1));
  const handleZoomOut = () => setZoom(prev => Math.max(0.5, prev - 0.1));

  // 4. Mentés
  const handleSave = async () => {
    if (!imageRef.current || !cropGuideRef.current) return;
    setIsProcessing(true);

    try {
      const imageRect = imageRef.current.getBoundingClientRect();
      const cropRect = cropGuideRef.current.getBoundingClientRect();

      // Arányszámítás: (Eredeti pixel méret / Megjelenített méret)
      const scaleX = imageRef.current.naturalWidth / imageRect.width;
      const scaleY = imageRef.current.naturalHeight / imageRect.height;

      const pixelCrop = {
        x: (cropRect.left - imageRect.left) * scaleX,
        y: (cropRect.top - imageRect.top) * scaleY,
        width: cropRect.width * scaleX,
        height: cropRect.height * scaleY,
      };

      // Negatív koordináta javítása
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
      <h3 className={styles.title}>HÚZD A KÉPET A MOZGATÁSHOZ</h3>
      
      {/* A munkaterületen figyeljük a húzást */}
      <div 
        className={styles.cropAreaWrapper} 
        onPointerDown={handlePointerDown}
      >
        {/* 1. Réteg: KÉP (Alul) */}
        <img
          ref={imageRef}
          src={imageSrc}
          alt="Crop target"
          className={styles.image}
          style={{
            ...baseStyle,
            transform: `translate(${position.x}px, ${position.y}px) scale(${zoom})`,
          }}
          onLoad={onImageLoad}
          draggable={false}
        />

        {/* 2. Réteg: MASZK/KERET (Felül) */}
        <div className={styles.overlay} ref={cropGuideRef}></div>
      </div>
      
      <div className={styles.controls}>
        <div className={styles.sliderContainer}>
          <button className={styles.zoomBtn} onClick={handleZoomOut}>−</button>
          <input
            type="range"
            value={zoom}
            min={0.5}
            max={3}
            step={0.05}
            onChange={(e) => setZoom(Number(e.target.value))}
            className={styles.slider}
          />
          <button className={styles.zoomBtn} onClick={handleZoomIn}>+</button>
        </div>
        
        <div className={styles.buttons}>
          <Button variant="ghost" onClick={onCancel} disabled={isProcessing}>
            MÉGSE
          </Button>
          <Button onClick={handleSave} disabled={isProcessing}>
            {isProcessing ? 'MENTÉS...' : 'KÉSZ'}
          </Button>
        </div>
      </div>
    </div>
  );
}
