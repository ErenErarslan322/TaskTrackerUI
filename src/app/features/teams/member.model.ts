export type ProfileStatus = 'Çevrimiçi' | 'Çevrimdışı' | 'Dışarıda';

export interface TeamMember {
  id: number;
  name: string;
  email: string;
  role: 'Kurucu' | 'Yönetici' | 'Takım Üyesi';
  status: ProfileStatus;
}

export interface Team {
  id: string;
  name: string;
  owner: string; // Takım kurucusunun kullanıcı adı
  members: TeamMember[];
}
