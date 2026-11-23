# TaskTrackerUI testleri

- `unit/components/layout/` üst çubuk ve sol menünün davranışlarını kapsar.
- `unit/components/pages/` sayfa şablonlarını, formları ve kullanıcı etkileşimlerini kapsar.
- `unit/services/` servis durumunu, HTTP isteklerini, SignalR olaylarını ve hata senaryolarını kapsar.
- `integration/` gerçek Angular bileşenleri, yönlendirme ve servislerle birden fazla parçayı bir arada test eder.
- `support/` ortak örnek verileri ve SignalR test bağlantısını içerir.

Tüm testleri bir kez çalıştırmak için:

```sh
npm test -- --watch=false
```

Tek bir test dosyasını çalıştırmak için:

```sh
npm test -- --watch=false --include src/tests/integration/search-navigation.spec.ts
```

Testlerde HTTP ve SignalR bağlantıları taklit edilir. API’yi veya veritabanını başlatmak gerekmez.
