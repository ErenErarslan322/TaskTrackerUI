import { HttpInterceptorFn } from '@angular/common/http';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  // Tarayıcı hafızasına kaydettiğimiz token'ı alıyoruz
  const token = localStorage.getItem('token');
  
  if (token) {
    // Eğer token varsa, API'ye giden isteğin içine gizlice ekliyoruz
    const cloned = req.clone({
      setHeaders: {
        Authorization: `Bearer ${token}`
      }
    });
    return next(cloned);
  }
  
  return next(req);
};
