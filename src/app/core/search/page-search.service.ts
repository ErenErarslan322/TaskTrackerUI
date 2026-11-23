import { computed, inject, Injectable, linkedSignal } from '@angular/core';
import { PRIMARY_OUTLET, Router } from '@angular/router';

const searchLabels: Record<string, string> = {
  tasks: 'Görev başlığı ara',
  members: 'Seçili takımda üye ara',
  messages: 'Kişi veya mesaj ara'
};

export function normalizeSearchText(text: string): string {
  return text.trim().toLowerCase().normalize('NFD').replace(/\p{M}/gu, '').replaceAll('ı', 'i');
}

@Injectable({ providedIn: 'root' })
export class PageSearchService {
  private readonly router = inject(Router);
  private readonly page = computed(() =>
    this.router.lastSuccessfulNavigation()?.finalUrl?.root.children[PRIMARY_OUTLET]?.segments[0]?.path
  );

  readonly label = computed(() => searchLabels[this.page() ?? '']);
  readonly query = linkedSignal({ source: this.page, computation: () => '' });

  queryFor(page: string): string {
    return this.page() === page ? normalizeSearchText(this.query()) : '';
  }
}
