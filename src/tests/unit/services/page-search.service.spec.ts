import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { beforeEach, describe, expect, it } from 'vitest';
import { normalizeSearchText, PageSearchService } from '../../../app/core/search/page-search.service';

@Component({ template: '' })
class SearchPage {}

describe('PageSearchService', () => {
  let search: PageSearchService;
  let router: Router;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideRouter(['tasks', 'members', 'messages', 'home', 'settings']
        .map(path => ({ path, component: SearchPage })))]
    });
    search = TestBed.inject(PageSearchService);
    router = TestBed.inject(Router);
  });

  it('normalizes Turkish characters, accents and surrounding whitespace', () => {
    expect(normalizeSearchText('  İŞ ÇÖZÜMÜ  ')).toBe('is cozumu');
    expect(normalizeSearchText('Kırmızı')).toBe('kirmizi');
  });

  it('keeps the query for the same page and clears it when switching pages', async () => {
    await router.navigateByUrl('/tasks');
    search.query.set('  İŞ  ');
    expect(search.label()).toBe('Görev başlığı ara');
    expect(search.queryFor('tasks')).toBe('is');
    expect(search.queryFor('members')).toBe('');

    await router.navigateByUrl('/tasks?view=calendar');
    expect(search.query()).toBe('  İŞ  ');
    await router.navigateByUrl('/members');
    expect(search.label()).toBe('Seçili takımda üye ara');
    expect(search.query()).toBe('');
    await router.navigateByUrl('/messages');
    expect(search.label()).toBe('Kişi veya mesaj ara');
    await router.navigateByUrl('/settings');
    expect(search.label()).toBeUndefined();
    await router.navigateByUrl('/home');
    expect(search.label()).toBeUndefined();
  });
});
