#!/bin/bash
# ==============================================================================
# MOSA OS - Tailscale SSL Certificate Installer
# Automatically installs Tailscale's official Let's Encrypt SSL certificate into NGINX
# ==============================================================================

set -e

DOMAIN=${1:-"mosa-home.tail01b9ef.ts.net"}

echo "🔒 جاري طلب شهادة SSL الرسمية والمعتمدة عالمياً (Let's Encrypt) لـ: $DOMAIN..."

if ! sudo tailscale cert "$DOMAIN"; then
    echo ""
    echo "⚠️ لم يتم تفعيل HTTPS في حساب Tailscale بعد!"
    echo "👉 يرجى الدخول إلى لوحة تحكم Tailscale:"
    echo "   https://login.tailscale.com/admin/dns"
    echo "   ثم تفعيل خيار (Enable HTTPS Certificates) بضغطة واحدة، ثم أعد تشغيل هذا السكربت."
    exit 1
fi

echo "📦 حقن الشهادات الرسمية داخل حاوية mosa-nginx..."
sudo docker cp "$DOMAIN.crt" mosa-nginx:/etc/nginx/certs/nginx.crt
sudo docker cp "$DOMAIN.key" mosa-nginx:/etc/nginx/certs/nginx.key

# حفظ نسخة محلية دائمة
mkdir -p ./nginx-certs
sudo cp "$DOMAIN.crt" ./nginx-certs/nginx.crt
sudo cp "$DOMAIN.key" ./nginx-certs/nginx.key

echo "🔄 إعادة تحميل إعدادات NGINX لتفعيل القفل الأخضر..."
sudo docker exec mosa-nginx nginx -s reload || sudo docker restart mosa-nginx

echo "======================================================================"
echo "✅ تم بنجاح! المنصة الآن تعمل بشهادة أمان رسمية وموثوقة عالمياً 🔒"
echo "🌐 افتح المتصفح الآن وادخل إلى: https://$DOMAIN"
echo "======================================================================"
