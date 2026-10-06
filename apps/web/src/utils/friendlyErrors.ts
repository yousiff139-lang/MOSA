/**
 * MOSA Friendly Error Translation & Humanized Arabic Messages
 * Replaces technical codes, stack traces, and English errors with comforting, clear Arabic.
 */

export function getFriendlyErrorMessage(error: any, fallbackMessage = 'حدث خطأ بسيط، يرجى المحاولة مرة أخرى.'): string {
  if (!error) return fallbackMessage;

  const errStr = typeof error === 'string' 
    ? error 
    : (error.message || error.statusText || error.code || JSON.stringify(error));

  const lower = errStr.toLowerCase();

  // 1. Network / Connectivity / 503 / Timeout
  if (lower.includes('503') || lower.includes('networkerror') || lower.includes('failed to fetch') || lower.includes('econnrefused') || lower.includes('offline')) {
    return 'الجهاز غير متصل حالياً بالكهرباء أو الواي فاي. يرجى التأكد من تشغيله.';
  }

  if (lower.includes('timeout') || lower.includes('etimedout') || lower.includes('connack timeout')) {
    return 'تأخر الجهاز في الرد، جارِ إعادة المحاولة تلقائياً...';
  }

  // 2. Authentication / Session Expiration (401)
  if (lower.includes('401') || lower.includes('unauthorized') || lower.includes('jwt') || lower.includes('token')) {
    return 'انتهت مدة الجلسة لأسباب أمنية. يرجى تسجيل الدخول مجدداً.';
  }

  // 3. Permissions & Gated Actions (403)
  if (lower.includes('403') || lower.includes('forbidden') || lower.includes('access denied')) {
    return 'هذا الإجراء مخصص لمدير المنزل فقط.';
  }

  // 4. Resource Not Found (404)
  if (lower.includes('404') || lower.includes('not found')) {
    return 'الجهاز أو السيناريو المطلوب غير موجود أو تمت إزالته.';
  }

  // 5. Hardware / Pin / MQTT Disconnects
  if (lower.includes('mqtt') || lower.includes('socket') || lower.includes('broker')) {
    return 'جارِ إعادة مزامنة الأجهزة مع السيرفر المنزلي...';
  }

  if (lower.includes('pin') || lower.includes('gpio') || lower.includes('relay')) {
    return 'تعذر إرسال الإشارة للمفتاح الفيزيائي، اضغط لإعادة المحاولة.';
  }

  return fallbackMessage;
}
