#!/bin/bash
# Me caigo de risa — servidor local para la tablet
cd "$(dirname "$0")" || exit 1

PORT="${PORT:-8899}"

IP=""
for IFACE in en0 en1 en2; do
  IP=$(ipconfig getifaddr "$IFACE" 2>/dev/null)
  [ -n "$IP" ] && break
done

echo "=============================================="
echo "  Me caigo de risa — El desafío"
echo "=============================================="
echo "  En esta computadora:  http://localhost:$PORT"
if [ -n "$IP" ]; then
  echo "  En la tablet:         http://$IP:$PORT"
else
  echo "  No detecté la red Wi-Fi. Revisa la conexión."
fi
echo "----------------------------------------------"
echo "  Para detener el servidor: Ctrl + C"
echo "=============================================="
echo

python3 -m http.server "$PORT"
