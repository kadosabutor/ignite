import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './index.css';
import { isPushSupported, subscribeToPush } from './lib/push';

// Register service worker for PWA and Push Notifications
async function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) {
    console.warn('Service Worker not supported');
    return;
  }

  try {
    const registration = await navigator.serviceWorker.register('/sw.js');
    console.log('Service Worker registered:', registration.scope);
    return registration;
  } catch (error) {
    console.error('Service Worker registration failed:', error);
  }
}

// Initialize push notifications if already granted
async function initializePushNotifications() {
  if (!isPushSupported()) {
    console.log('Push notifications not supported');
    return;
  }

  if (Notification.permission === 'granted') {
    try {
      const subscription = await subscribeToPush();
      if (subscription) {
        console.log('Push subscription active:', subscription.endpoint);
      }
    } catch (error) {
      console.error('Error initializing push:', error);
    }
  }
}

// Initialize app
window.addEventListener('load', async () => {
  await registerServiceWorker();
  await initializePushNotifications();
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
