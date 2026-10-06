# SRE Runbook: MQTT Broker (Mosquitto) Down

## أعراض العطل (Symptoms)
- لا يمكن التحكم في الأجهزة من التطبيق.
- تنبيه `API_High_Latency` أو بطء في استجابة الأوامر.
- تظهر الأجهزة كأنها Offline (توقف التحديثات الحية).

## التشخيص (Diagnosis)
1. تأكد من عمل الحاوية: `docker ps | findstr mosquitto` (أو `grep` في Linux).
2. تحقق من سجلات الحاوية: `docker logs mosa-mosquitto --tail 50`.

## الحل السريع (Mitigation)
1. إعادة تشغيل الحاوية: `docker restart mosa-mosquitto`
2. تحقق مما إذا كان الباك إند يعيد الاتصال بنجاح. إذا لم يتم ذلك، أعد تشغيل الباك إند: `docker restart mosa-backend`.
