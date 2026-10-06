import { Instrument, InstrumentSection, InstrumentItem } from '../types';

export interface TemplateIndicator {
  code: string;
  indicator: string;
  description: string;
  min_score: number;
  max_score: number;
  sort_order: number;
}

export interface TemplateSection {
  title: string;
  weight: number;
  sort_order: number;
  items: TemplateIndicator[];
}

export interface InstrumentTemplate {
  type: 'RPPM' | 'SUPERVISI_PEMBELAJARAN';
  title: string;
  description: string;
  version: string;
  sections: TemplateSection[];
}

export const DEFAULT_RPPM_TEMPLATE: InstrumentTemplate = {
  type: 'RPPM',
  title: 'Instrumen Telaah RPPM (Rencana Pembelajaran Mendalam)',
  description: 'Instrumen resmi telaah dokumen RPPM berbasis prinsip Mindful, Meaningful, dan Joyful Learning (Skala 1 - 3).',
  version: 'v1.0',
  sections: [
    {
      title: 'A. Informasi Umum',
      weight: 10,
      sort_order: 1,
      items: [
        {
          code: 'IND-RPP-A1',
          indicator: 'Terdapat nama penyusun, institusi, tahun disusunnya, kelas, dan alokasi waktu.',
          description: 'Pedoman Skor: 1 = Tidak Ada/Kurang, 2 = Sebagian Lengkap, 3 = Sangat Lengkap & Jelas.',
          min_score: 1,
          max_score: 3,
          sort_order: 1,
        },
      ],
    },
    {
      title: 'B. Identifikasi',
      weight: 15,
      sort_order: 2,
      items: [
        {
          code: 'IND-RPP-B1',
          indicator: 'Identifikasi Kesiapan Murid',
          description: 'Mendeskripsikan asesmen awal atau analisis latar belakang kesiapan belajar murid.',
          min_score: 1,
          max_score: 3,
          sort_order: 1,
        },
        {
          code: 'IND-RPP-B2',
          indicator: 'Karakteristik Mata Pelajaran',
          description: 'Menggambarkan sifat, esensi, dan konteks khas materi pelajaran.',
          min_score: 1,
          max_score: 3,
          sort_order: 2,
        },
        {
          code: 'IND-RPP-B3',
          indicator: 'Dimensi Profil Lulusan',
          description: 'Memuat pemetaan karakter dan kompetensi lulusan yang disasar.',
          min_score: 1,
          max_score: 3,
          sort_order: 3,
        },
      ],
    },
    {
      title: 'C. Desain Pembelajaran',
      weight: 20,
      sort_order: 3,
      items: [
        {
          code: 'IND-RPP-C1',
          indicator: 'Tujuan Pembelajaran memuat kompetensi dan materi yang akan dicapai.',
          description: 'Tujuan terukur, memuat elemen kompetensi utama serta pemahaman konseptual.',
          min_score: 1,
          max_score: 3,
          sort_order: 1,
        },
        {
          code: 'IND-RPP-C2',
          indicator: 'Kerangka pembelajaran memuat praktik pedagogis, kemitraan pembelajaran, lingkungan belajar, dan pemanfaatan digital.',
          description: 'Mengintegrasikan 4 pilar kerangka pembelajaran mendalam secara komprehensif.',
          min_score: 1,
          max_score: 3,
          sort_order: 2,
        },
      ],
    },
    {
      title: 'D. Pengalaman Belajar',
      weight: 25,
      sort_order: 4,
      items: [
        {
          code: 'IND-RPP-D1',
          indicator: 'Deskripsi rancangan pembelajaran menggambarkan tiga prinsip pembelajaran mendalam: berkesadaran, bermakna dan menyenangkan.',
          description: 'Desain alur memenuhi prinsip Mindful, Meaningful, dan Joyful Learning.',
          min_score: 1,
          max_score: 3,
          sort_order: 1,
        },
        {
          code: 'IND-RPP-D2',
          indicator: 'Mendeskripsikan pengalaman belajar dimulai dari memahami, mengaplikasi dan merefleksi.',
          description: 'Tahapan pembelajaran berurutan runtut: Memahami -> Mengaplikasi -> Merefleksi.',
          min_score: 1,
          max_score: 3,
          sort_order: 2,
        },
        {
          code: 'IND-RPP-D3',
          indicator: 'Deskripsi pengalaman belajar menggambarkan sintak model pembelajaran yang digunakan.',
          description: 'Sintaks model pembelajaran (PBL/PJBL/Inquiry/lainnya) tergambar jelas.',
          min_score: 1,
          max_score: 3,
          sort_order: 3,
        },
      ],
    },
    {
      title: 'E. Asesmen Pembelajaran',
      weight: 15,
      sort_order: 5,
      items: [
        {
          code: 'IND-RPP-E1',
          indicator: 'Asesmen awal pembelajaran.',
          description: 'Rancangan asesmen diagnostik awal untuk mengukur kesiapan awal murid.',
          min_score: 1,
          max_score: 3,
          sort_order: 1,
        },
        {
          code: 'IND-RPP-E2',
          indicator: 'Asesmen proses pembelajaran.',
          description: 'Rancangan asesmen formatif berkelanjutan selama proses pembelajaran.',
          min_score: 1,
          max_score: 3,
          sort_order: 2,
        },
        {
          code: 'IND-RPP-E3',
          indicator: 'Asesmen akhir pembelajaran.',
          description: 'Rancangan asesmen sumatif / evaluasi pencapaian akhir tujuan pembelajaran.',
          min_score: 1,
          max_score: 3,
          sort_order: 3,
        },
        {
          code: 'IND-RPP-E4',
          indicator: 'Pedoman asesmen.',
          description: 'Lengkap dengan kriteria rubrik, indikator pencapaian, dan pedoman penskoran.',
          min_score: 1,
          max_score: 3,
          sort_order: 4,
        },
      ],
    },
    {
      title: 'F. Komponen Tambahan',
      weight: 15,
      sort_order: 6,
      items: [
        {
          code: 'IND-RPP-F1',
          indicator: 'Kriteria minimal sesuai pedoman penyusunan rencana pembelajaran.',
          description: 'Memenuhi seluruh kelengkapan komponen standar pedoman sekolah/kementerian.',
          min_score: 1,
          max_score: 3,
          sort_order: 1,
        },
        {
          code: 'IND-RPP-F2',
          indicator: 'Template menarik dan inovatif.',
          description: 'Format penulisan dan visualisasi modul pembelajaran disajikan secara estetis.',
          min_score: 1,
          max_score: 3,
          sort_order: 2,
        },
        {
          code: 'IND-RPP-F3',
          indicator: 'Bahasa baik dan benar.',
          description: 'Menggunakan tata bahasa baku dan ejaan bahasa Indonesia yang disempurnakan.',
          min_score: 1,
          max_score: 3,
          sort_order: 3,
        },
        {
          code: 'IND-RPP-F4',
          indicator: 'Kalimat efektif dan efisien.',
          description: 'Struktur penulisan lugas, tidak bertele-tele, dan mudah dipahami.',
          min_score: 1,
          max_score: 3,
          sort_order: 4,
        },
      ],
    },
  ],
};

export const DEFAULT_SUPERVISI_TEMPLATE: InstrumentTemplate = {
  type: 'SUPERVISI_PEMBELAJARAN',
  title: 'Instrumen Supervisi PM (Pembelajaran Mendalam)',
  description: 'Instrumen resmi observasi supervisi proses Pembelajaran Mendalam (28 Indikator, Skala 1 - 4, Skor Maksimal 112).',
  version: 'v1.0',
  sections: [
    {
      title: 'I. Kegiatan Memahami (6 Indikator)',
      weight: 20,
      sort_order: 1,
      items: [
        {
          code: 'IND-SUP-01',
          indicator: 'Guru mengondisikan kesiapan belajar murid dan suasana kelas berkesadaran (mindful & inklusif).',
          description: 'Pengondisian awal kelas aman, fokus, dan siap menerima pembelajaran.',
          min_score: 1,
          max_score: 4,
          sort_order: 1,
        },
        {
          code: 'IND-SUP-02',
          indicator: 'Guru melakukan persepsi dan apersepsi mengaitkan materi dengan pengalaman awal murid.',
          description: 'Apersepsi kontekstual menghubungkan materi dengan pengetahuan awal murid.',
          min_score: 1,
          max_score: 4,
          sort_order: 2,
        },
        {
          code: 'IND-SUP-03',
          indicator: 'Guru menyampaikan tujuan pembelajaran dan pemahaman bermakna yang ingin dicapai.',
          description: 'Penyampaian target kompetensi dan manfaat nyata materi secara eksplisit.',
          min_score: 1,
          max_score: 4,
          sort_order: 3,
        },
        {
          code: 'IND-SUP-04',
          indicator: 'Guru memberikan pertanyaan pemantik memicu penalaran kritis dan pemikiran mendalam murid.',
          description: 'Pertanyaan HOTS yang menantang murid berpikir analisis dan eksploratif.',
          min_score: 1,
          max_score: 4,
          sort_order: 4,
        },
        {
          code: 'IND-SUP-05',
          indicator: 'Guru memfasilitasi murid memahami konsep inti melalui pemodelan dan penjelasan konseptual yang jelas.',
          description: 'Pemberian contoh, peragaan, atau penjelasan konsep utama secara lugas.',
          min_score: 1,
          max_score: 4,
          sort_order: 5,
        },
        {
          code: 'IND-SUP-06',
          indicator: 'Guru mendiagnosis pemahaman awal murid (formative diagnostic) sebelum melangkah ke praktik.',
          description: 'Cek pemahaman awal secara cepat untuk mengantisipasi miskonsepsi.',
          min_score: 1,
          max_score: 4,
          sort_order: 6,
        },
      ],
    },
    {
      title: 'II. Kegiatan Mengaplikasikan (16 Indikator)',
      weight: 60,
      sort_order: 2,
      items: [
        {
          code: 'IND-SUP-07',
          indicator: 'Guru merancang dan memfasilitasi aktivitas belajar yang bermakna (meaningful learning).',
          description: 'Aktivitas otentik berorientasi pemecahan masalah kehidupan nyata.',
          min_score: 1,
          max_score: 4,
          sort_order: 1,
        },
        {
          code: 'IND-SUP-08',
          indicator: 'Guru mengintegrasikan pengalaman belajar yang menyenangkan (joyful learning) dan menantang.',
          description: 'Atmosfer belajar antusias, menyenangkan, serta interaktif.',
          min_score: 1,
          max_score: 4,
          sort_order: 2,
        },
        {
          code: 'IND-SUP-09',
          indicator: 'Guru memfasilitasi sintaks model pembelajaran (PBL/PJBL/Inquiry/Discovery) secara konsisten.',
          description: 'Langkah-langkah model pembelajaran tereksekusi secara terstruktur.',
          min_score: 1,
          max_score: 4,
          sort_order: 3,
        },
        {
          code: 'IND-SUP-10',
          indicator: 'Guru mendorong kolaborasi aktif dan kerja sama positif antar murid dalam kelompok.',
          description: 'Dinamika kelompok interaktif dan saling mendukung.',
          min_score: 1,
          max_score: 4,
          sort_order: 4,
        },
        {
          code: 'IND-SUP-11',
          indicator: 'Guru memberikan instruksi kerja dan petunjuk penugasan yang sistematis dan mudah dipahami.',
          description: 'Instruksi penugasan jelas, terstruktur, dan mengurangi kebingungan murid.',
          min_score: 1,
          max_score: 4,
          sort_order: 5,
        },
        {
          code: 'IND-SUP-12',
          indicator: 'Guru memfasilitasi diferensiasi proses sesuai kesiapan dan gaya belajar murid.',
          description: 'Aktivitas mengakomodasi variasi kecepatan dan profil belajar murid.',
          min_score: 1,
          max_score: 4,
          sort_order: 6,
        },
        {
          code: 'IND-SUP-13',
          indicator: 'Guru memfasilitasi pemanfaatan media digital atau AI secara bijak dan eksploratif.',
          description: 'Teknologi/AI digunakan untuk memperdalam pemahaman konsep.',
          min_score: 1,
          max_score: 4,
          sort_order: 7,
        },
        {
          code: 'IND-SUP-14',
          indicator: 'Guru memandu murid mengumpulkan, menganalisis, dan mengolah data atau informasi.',
          description: 'Proses investigasi data/informasi terbimbing dengan baik.',
          min_score: 1,
          max_score: 4,
          sort_order: 8,
        },
        {
          code: 'IND-SUP-15',
          indicator: 'Guru mendorong murid menyampaikan argumen dan solusi masalah berdasarkan bukti otentik.',
          description: 'Latihan penarikan kesimpulan dan argumentasi ilmiah berdasar data.',
          min_score: 1,
          max_score: 4,
          sort_order: 9,
        },
        {
          code: 'IND-SUP-16',
          indicator: 'Guru memberikan bantuan/scaffolding yang tepat saat murid mengalami hambatan belajar.',
          description: 'Bimbingan terarah tanpa langsung mendiktekan jawaban.',
          min_score: 1,
          max_score: 4,
          sort_order: 10,
        },
        {
          code: 'IND-SUP-17',
          indicator: 'Guru mengobservasi dan memantau keterlibatan seluruh murid secara merata selama aktivitas.',
          description: 'Pemantauan aktif ke seluruh sudut dan kelompok kelas.',
          min_score: 1,
          max_score: 4,
          sort_order: 11,
        },
        {
          code: 'IND-SUP-18',
          indicator: 'Guru memberikan umpan balik langsung (real-time feedback) yang konstruktif dan memotivasi.',
          description: 'Umpan balik spesifik pada momen kerja siswa.',
          min_score: 1,
          max_score: 4,
          sort_order: 12,
        },
        {
          code: 'IND-SUP-19',
          indicator: 'Guru memfasilitasi murid mempresentasikan atau mendemonstrasikan hasil karya/kinerja.',
          description: 'Ruang unjuk kerja/presentasi karya bagi murid.',
          min_score: 1,
          max_score: 4,
          sort_order: 13,
        },
        {
          code: 'IND-SUP-20',
          indicator: 'Guru mendorong apresiasi dan tanggapan antar sesama murid (peer feedback).',
          description: 'Kultur saling memberikan masukan positif antar murid.',
          min_score: 1,
          max_score: 4,
          sort_order: 14,
        },
        {
          code: 'IND-SUP-21',
          indicator: 'Guru mengelola waktu pembelajaran secara proporsional dan efektif.',
          description: 'Alokasi waktu tiap tahapan berjalan efisien.',
          min_score: 1,
          max_score: 4,
          sort_order: 15,
        },
        {
          code: 'IND-SUP-22',
          indicator: 'Guru menunjukkan disiplin positif dan komunikasi empati di sepanjang proses pembelajaran.',
          description: 'Sikap ramah, ramah anak, dan bebas kekerasan verbal/fisik.',
          min_score: 1,
          max_score: 4,
          sort_order: 16,
        },
      ],
    },
    {
      title: 'III. Kegiatan Refleksi (6 Indikator)',
      weight: 20,
      sort_order: 3,
      items: [
        {
          code: 'IND-SUP-23',
          indicator: 'Guru memandu murid melakukan refleksi tentang apa yang telah dipahami dan dirasakan (Mindful & Meaningful).',
          description: 'Proses perenungan pengalaman belajar dan emosi murid.',
          min_score: 1,
          max_score: 4,
          sort_order: 1,
        },
        {
          code: 'IND-SUP-24',
          indicator: 'Guru bersama murid menyimpulkan konsep utama dan poin-poin penting pembelajaran.',
          description: 'Penyimpulan pembelajaran secara kolaboratif.',
          min_score: 1,
          max_score: 4,
          sort_order: 2,
        },
        {
          code: 'IND-SUP-25',
          indicator: 'Guru melakukan asesmen formatif akhir (exit ticket/kuis) untuk mengukur ketercapaian tujuan.',
          description: 'Evaluasi singkat pencapaian tujuan pembelajaran.',
          min_score: 1,
          max_score: 4,
          sort_order: 3,
        },
        {
          code: 'IND-SUP-26',
          indicator: 'Guru memberikan penguatan, apresiasi atas usaha murid, dan motivasi tindak lanjut.',
          description: 'Pemberian apresiasi verbal atas partisipasi murid.',
          min_score: 1,
          max_score: 4,
          sort_order: 4,
        },
        {
          code: 'IND-SUP-27',
          indicator: 'Guru menyampaikan arahan kegiatan atau tugas terstruktur untuk pertemuan berikutnya.',
          description: 'Petunjuk jelas persiapan materi / proyek pertemuan berikutnya.',
          min_score: 1,
          max_score: 4,
          sort_order: 5,
        },
        {
          code: 'IND-SUP-28',
          indicator: 'Guru menutup pembelajaran dengan santun, doa bersama, dan pembiasaan positif.',
          description: 'Penutupan kelas berkarakter positif dan teratur.',
          min_score: 1,
          max_score: 4,
          sort_order: 6,
        },
      ],
    },
  ],
};

export const DEFAULT_INSTRUMENTS_TEMPLATES: InstrumentTemplate[] = [
  DEFAULT_RPPM_TEMPLATE,
  DEFAULT_SUPERVISI_TEMPLATE,
];

export const DEFAULT_RPPM_INSTRUMENT_ID = 'b1fc8a2b-d242-42f0-ba01-a719ad7a4c4c';
export const DEFAULT_SUPERVISI_INSTRUMENT_ID = '4d89ba8f-b086-4388-b0df-a344ed375d68';

export function getDefaultInstruments(schoolId?: string): Instrument[] {
  const rppmPrefix = DEFAULT_RPPM_INSTRUMENT_ID.slice(0, 24); // 'b1fc8a2b-d242-42f0-ba01-'
  const supervisiPrefix = DEFAULT_SUPERVISI_INSTRUMENT_ID.slice(0, 24); // '4d89ba8f-b086-4388-b0df-'

  return [
    {
      id: DEFAULT_RPPM_INSTRUMENT_ID,
      school_id: schoolId,
      type: 'RPPM',
      title: DEFAULT_RPPM_TEMPLATE.title,
      description: DEFAULT_RPPM_TEMPLATE.description,
      version: DEFAULT_RPPM_TEMPLATE.version,
      is_active: true,
      created_at: '2026-09-10T04:41:28.949075+00:00',
      updated_at: '2026-09-10T04:41:28.949075+00:00',
      sections: DEFAULT_RPPM_TEMPLATE.sections.map((sec, secIdx): InstrumentSection => {
        const secId = `${rppmPrefix}${String(secIdx + 1).padStart(12, '0')}`;
        return {
          id: secId,
          instrument_id: DEFAULT_RPPM_INSTRUMENT_ID,
          title: sec.title,
          weight: sec.weight,
          sort_order: sec.sort_order,
          created_at: '2026-09-10T04:41:28.949075+00:00',
          items: sec.items.map((item, itemIdx): InstrumentItem => ({
            id: `${rppmPrefix}${String(secIdx + 1).padStart(6, '0')}${String(itemIdx + 1).padStart(6, '0')}`,
            section_id: secId,
            code: item.code,
            indicator: item.indicator,
            description: item.description,
            min_score: item.min_score,
            max_score: item.max_score,
            is_active: true,
            sort_order: item.sort_order,
            created_at: '2026-09-10T04:41:28.949075+00:00',
          })),
        };
      }),
    },
    {
      id: DEFAULT_SUPERVISI_INSTRUMENT_ID,
      school_id: schoolId,
      type: 'SUPERVISI_PEMBELAJARAN',
      title: DEFAULT_SUPERVISI_TEMPLATE.title,
      description: DEFAULT_SUPERVISI_TEMPLATE.description,
      version: DEFAULT_SUPERVISI_TEMPLATE.version,
      is_active: true,
      created_at: '2026-09-10T04:41:28.949075+00:00',
      updated_at: '2026-09-10T04:41:28.949075+00:00',
      sections: DEFAULT_SUPERVISI_TEMPLATE.sections.map((sec, secIdx): InstrumentSection => {
        const secId = `${supervisiPrefix}${String(secIdx + 1).padStart(12, '0')}`;
        return {
          id: secId,
          instrument_id: DEFAULT_SUPERVISI_INSTRUMENT_ID,
          title: sec.title,
          weight: sec.weight,
          sort_order: sec.sort_order,
          created_at: '2026-09-10T04:41:28.949075+00:00',
          items: sec.items.map((item, itemIdx): InstrumentItem => ({
            id: `${supervisiPrefix}${String(secIdx + 1).padStart(6, '0')}${String(itemIdx + 1).padStart(6, '0')}`,
            section_id: secId,
            code: item.code,
            indicator: item.indicator,
            description: item.description,
            min_score: item.min_score,
            max_score: item.max_score,
            is_active: true,
            sort_order: item.sort_order,
            created_at: '2026-09-10T04:41:28.949075+00:00',
          })),
        };
      }),
    },
  ];
}

