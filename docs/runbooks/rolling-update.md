# SRE Runbook: Rolling Updates (Zero-Downtime)

## الغرض
كيفية نشر تحديث جديد للمنصة دون التسبب بانقطاع الخدمة عن المستخدمين (Zero-Downtime).

## الإجراءات
في حال كنا نستخدم Docker Swarm أو Kubernetes، التحديث يتم برمجياً عبر الـ CI/CD. 
ولكن في بيئة Docker Compose المستقلة (Standalone):

1. اسحب أحدث الكود: `git pull origin main`
2. ابدأ الحاوية الجديدة في الخلفية لبناء صورتها:
   `docker compose -f docker-compose.prod.yml build`
3. قم بتشغيل التحديث مع إبقاء الخدمة تعمل:
   `docker compose -f docker-compose.prod.yml up -d --no-deps --build mosa-backend`
4. Docker سيقوم بإطفاء الحاوية القديمة فوراً وتشغيل الجديدة خلال ثوانٍ معدودة.

> [!TIP]
> بفضل إعداد الـ `reconnection: true` في الـ Frontend Socket.io، الأجهزة والمستخدمين سيعيدون الاتصال فوراً بالنسخة الجديدة دون أن يلاحظوا أي انقطاع!
