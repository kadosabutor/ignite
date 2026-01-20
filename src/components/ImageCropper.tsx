import { useState, useCallback } from 'react';
import Cropper from 'react-easy-crop';
import { Button } from './ui';
import getCroppedImg from '../lib/cropImage';
import styles from './ImageCropper.module.css';

interface ImageCropperProps {
  imageSrc: string;
  onCancel: () => void;
  onCropComplete: (file: File) => void;
}

export function ImageCropper({ imageSrc, onCancel, onCropComplete }: ImageCropperProps) {
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<any>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const onCropChange = (crop: { x: number; y: number }) => {
    setCrop(crop);
  };

  const onZoomChange = (zoom: number) => {
    setZoom(zoom);
  };

  const onCropCompleteCallback = useCallback((_croppedArea: any, croppedAreaPixels: any) => {
    setCroppedAreaPixels(croppedAreaPixels);
  }, []);

  const handleSave = async () => {
    if (!croppedAreaPixels) return;
    setIsProcessing(true);
    try {
      const croppedFile = await getCroppedImg(imageSrc, croppedAreaPixels);
      onCropComplete(croppedFile);
    } catch (e) {
      console.error(e);
      setIsProcessing(false);
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.cropperWrapper}>
        <Cropper
          image={imageSrc}
          crop={crop}
          zoom={zoom}
          aspect={1} // 1:1 arány (négyzet/kör)
          cropShape="round" // Kör alakú maszk!
          showGrid={false}
          onCropChange={onCropChange}
          onZoomChange={onZoomChange}
          onCropComplete={onCropCompleteCallback}
        />
      </div>
      
      <div className={styles.controls}>
        <div className={styles.sliderContainer}>
          <span className={styles.sliderLabel}>−</span>
          <input
            type="range"
            value={zoom}
            min={1}
            max={3}
            step={0.1}
            aria-labelledby="Zoom"
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
            {isProcessing ? 'Feldolgozás...' : 'Kész'}
          </Button>
        </div>
      </div>
    </div>
  );
}
