# SRE Runbook: Redis Cache/Session Down

## أعراض العطل (Symptoms)
- بطء شديد في الـ APIs التي تعتمد على الكاش.
- فقدان المصادقة لبعض المستخدمين (الرموز المعتمدة على الـ Blacklisting).
- فقدان الاتصالات الحية (Socket.io Disconnections) حيث يعمل Redis كـ Adapter للتوسعة.

## التشخيص (Diagnosis)
- `docker ps -a | grep mosa-redis`.
- سجلات الأخطاء في الباك إند ستظهر: `Redis connection to mosa-redis:6379 failed`.

## الحل السريع (Mitigation)
1. الـ Backend مهيأ لتجاوز Redis واستخدام الذاكرة المؤقتة (Failover) إذا سقط لتجنب توقف المنصة بالكامل (كما صممناه في `server.ts`).
2. لإعادة الكاش: `docker restart mosa-redis`.
