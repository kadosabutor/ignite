# Push Notification Edge Function - Testing Guide

## Testing with Postman

Az FCM (Firebase Cloud Messaging) endpoint-okat **nem lehet közvetlenül** Postman-ből hívni, mert:
- VAPID autentikációt igényelnek
- Titkosított payload-ot várnak
- Specifikus HTTP header-eket használnak

### Helyette: Teszteld a saját Edge Function-ödet

1. **Készítsd elő a kérést Postman-ben:**

   **URL:**
   ```
   https://thibewmulezvjenwowmh.supabase.co/functions/v1/send-push?debug=true
   ```

   **Method:** `POST`

   **Headers:**
   ```
   Content-Type: application/json
   Authorization: Bearer YOUR_SUPABASE_ACCESS_TOKEN
   ```

   **Hogyan szerezheted meg a token-t?**

   **1. Böngésző Console-ban (ha be vagy jelentkezve az alkalmazásba):**
   ```javascript
   // Nyisd meg a böngésző DevTools Console-ját
   // Futtasd ezt a kódot:
   const { data: { session } } = await window.supabase.auth.getSession();
   console.log('Access Token:', session?.access_token);
   ```
   Másold ki a kiírt token-t és használd Postman-ben.

   **2. Postman-ben először bejelentkezés:**
   - Hozz létre egy új kérést: `POST https://thibewmulezvjenwowmh.supabase.co/auth/v1/token?grant_type=password`
   - Body (JSON):
     ```json
     {
       "email": "your-email@example.com",
       "password": "your-password"
     }
     ```
   - A válaszban az `access_token` mező tartalmazza a tokent

   **3. Alternatíva: Service Role Key (csak fejlesztéshez!):**
   - A Supabase Dashboard > Settings > API > `service_role` key
   - ⚠️ **FIGYELEM:** Ezt csak fejlesztéshez használd, soha ne oszd meg!

   **Body (JSON):**
   ```json
   {
     "recipientUserId": "user-uuid-here",
     "title": "Test Notification",
     "body": "This is a test push notification",
     "data": {
       "type": "ping",
       "friendId": "friend-uuid"
     }
   }
   ```

2. **Debug mód:**
   - Add hozzá a `?debug=true` query paramétert az URL-hez
   - Ekkor a válasz tartalmazza az összes FCM endpoint választ részletesen

3. **Válasz példa (debug módban):**
   ```json
   {
     "success": true,
     "sent": 1,
     "failed": 0,
     "message": "Notifications processed",
     "results": [
       {
         "endpoint": "https://fcm.googleapis.com/fcm/send/...",
         "success": true,
         "status": 201,
         "statusText": "Created",
         "responseBody": "..."
       }
     ]
   }
   ```

## FCM Endpoint információk

Az FCM endpoint-ok a következő formátumúak:
```
https://fcm.googleapis.com/fcm/send/{registration-token}
```

Ezeket az endpoint-okat a Supabase Edge Function automatikusan hívja, amikor push notification-t küldesz. A válaszokat a Supabase logokban láthatod, vagy a debug módban a Postman válaszban.

## Supabase Logok megtekintése

1. Menj a Supabase Dashboard-ra
2. Válaszd ki a projektet
3. Menj az "Edge Functions" menüpontra
4. Kattints a "send-push" function-re
5. Nézd meg a "Logs" fület

Itt láthatod:
- Minden FCM endpoint hívást
- A válasz status code-okat
- A válasz body-kat
- Hibákat

## Tesztelési lépések

1. **Először ellenőrizd, hogy van-e push subscription:**
   - A böngészőben nyisd meg a DevTools Console-t
   - Futtasd: `navigator.serviceWorker.ready.then(r => r.pushManager.getSubscription())`
   - Másold ki az `endpoint` értékét

2. **Szerezd meg a recipientUserId-t:**
   - Böngésző Console-ban: `(await window.supabase.auth.getUser()).data.user.id`
   - Vagy a Supabase Dashboard > Authentication > Users alatt

3. **Küldj egy teszt notification-t:**
   - Használd a fenti Postman kérést
   - Add meg a saját `recipientUserId`-d
   - Add meg a token-t az Authorization header-ben
   - Nézd meg a választ és a Supabase logokat

4. **Ellenőrizd a böngészőben:**
   - A notification meg kell jelennie
   - A Service Worker logokat a DevTools > Application > Service Workers alatt láthatod

## Gyors token megszerzés (Böngésző Console)

Ha már be vagy jelentkezve az alkalmazásba, a legegyszerűbb módszer:

1. Nyisd meg a böngésző DevTools-t (F12)
2. Menj a Console fülre
3. Futtasd ezt:
   ```javascript
   const { data: { session } } = await window.supabase.auth.getSession();
   console.log('Access Token:', session?.access_token);
   console.log('User ID:', session?.user?.id);
   ```
4. Másold ki mindkét értéket és használd Postman-ben
