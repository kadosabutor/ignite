# send-push

Web push értesítést küld egy felhasználó összes feliratkozott eszközére, és
elmenti az in-app értesítések közé (`notifications` tábla).

## Hívás

```
POST /functions/v1/send-push
Authorization: Bearer <felhasználó JWT vagy service role kulcs>

{ "recipientUserId": "<uuid>", "title": "...", "body": "...", "data": { "type": "ping" } }
```

- **Service role** (a `cron-scheduler` így hívja): bárkinek küldhet.
- **Felhasználói JWT**: csak olyannak, akivel van `friendships` sor (függő vagy elfogadott), saját magának nem.
- A cím legfeljebb 80, a szöveg legfeljebb 300 karakter.

## Secretek

`VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` (opcionális: `VAPID_SUBJECT`). Ha hiányoznak, a függvény 503-at ad.
A nyilvános kulcsnak egyeznie kell a `src/lib/push.ts`-ben lévővel.

Kulcspár generálása:

```bash
npx web-push generate-vapid-keys --json
```

## Lejárt feliratkozások

A 404/410 (lejárt) és 401/403 (más VAPID kulccsal készült) válaszú feliratkozásokat a függvény törli.
A kliens (`subscribeToPush`) kulcscsere után automatikusan újra feliratkozik.
