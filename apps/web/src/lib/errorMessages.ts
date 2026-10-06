// apps/web/src/lib/errorMessages.ts
export const ERROR_MESSAGES: Record<number, string> = {
  400: 'البيانات المدخلة غير صحيحة',
  401: 'انتهت جلستك، يرجى تسجيل الدخول مجدداً',
  403: 'ليس لديك صلاحية لهذا الإجراء',
  404: 'العنصر المطلوب غير موجود',
  409: 'هذا العنصر موجود مسبقاً',
  429: 'محاولات كثيرة، انتظر دقيقة وحاول مجدداً',
  500: 'حدث خطأ في الخادم، يرجى المحاولة لاحقاً',
  503: 'الخدمة غير متاحة مؤقتاً',
}

export function getErrorMessage(
  status: number, 
  fallback?: string
): string {
  return ERROR_MESSAGES[status] || 
         fallback || 
         'حدث خطأ غير متوقع'
}
