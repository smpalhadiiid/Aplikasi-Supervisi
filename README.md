# Supervisi Pembelajaran Mendalam AI (Deep Learning Pedagogy Supervisor)

Aplikasi manajemen dan supervisi pembelajaran berbasis **React 19, Express, Supabase, dan Google Gemini AI** yang dirancang khusus untuk lingkungan sekolah. Sistem ini membantu Kepala Sekolah dan Supervisor dalam mengobservasi praktik mengajar, menelaah Modul Ajar / RPPM, serta menyintesis rekomendasi berbasis bukti otentik dengan prinsip **Human-in-the-Loop**.

---

## 1. Arsitektur Sistem & Batas Tanggung Jawab

Aplikasi menggunakan arsitektur full-stack terpisah antara Client (SPA React) dan Backend (Express API proxy):

```
┌─────────────────────────────────────────────────────────────┐
│                      CLIENT (React 19)                      │
│ - Tampilan Antarmuka & Peta Navigasi                        │
│ - Supabase Auth Client (Menyimpan Session JWT)              │
│ - Formulir Human-in-the-Loop & Penilaian Manual             │
└──────────────────────────────┬──────────────────────────────┘
                               │ HTTP Request + Authorization: Bearer <JWT>
┌──────────────────────────────▼──────────────────────────────┐
│                    BACKEND (Express Proxy)                  │
│ - Rate Limiting & Auth Middleware (Verifikasi JWT Token)    │
│ - Sanitasi Input & Proteksi Prompt Injection                │
│ - Penanganan Dokumen (Mammoth DOCX, PDF-Parse, Magic Bytes) │
│ - Google Gemini AI Service (@google/genai SDK - Server Only)│
│ - Storage Service (Private Bucket & Signed URLs)            │
└──────────────────────────────┬──────────────────────────────┘
                               │
               ┌───────────────┴───────────────┐
               ▼                               ▼
       Supabase Firestore / Auth      Google Gemini API
```

### Batas Tanggung Jawab:
- **Client (Frontend)**: Hanya bertanggung jawab menampilkan antarmuka user, mengelola state lokal UI, meminta input konfirmasi supervisor, dan mengirimkan Supabase access token. Client **TIDAK BOLEH** menyimpan API Key rahasia atau menentukan role pengguna secara mandiri.
- **Backend (Express Server)**: Sumber kebenaran tunggal (*Single Source of Truth*) untuk otentikasi JWT, pemeriksaan hak akses role dari database, isolasi akses storage, validasi dokumen, dan komunikasi aman ke Google Gemini API.

---

## 2. Matriks Peran & Hak Akses (RBAC)

Sistem menerapkan Role-Based Access Control (RBAC) ketat yang diverifikasi di tingkat server:

| Fitur / Modul | Admin Sekolah (`ADMIN`) | Supervisor (`SUPERVISOR`) | Guru (`GURU`) |
|---|:---:|:---:|:---:|
| **Dashboard Utama** | Read / Write | Read / Write | Read (Milik Sendiri) |
| **Manajemen Guru & Sekolah** | Full Control | Read Only | No Access |
| **Penyusunan Instumen** | Full Control | Read Only | Read Only |
| **Telaah RPPM / Modul Ajar** | Full Control | Full Control | Read (Milik Sendiri) |
| **Supervisi Proses Mengajar** | Full Control | Full Control | Read (Milik Sendiri) |
| **Pemicuan AI Document Review**| Allowed | Allowed | No Access |
| **Penetapan Skor Resmi** | Allowed | Allowed | No Access |

---

## 3. Autentikasi, Otorisasi, & Penanganan JWT

1. **Alur Login**: Pengguna melakukan otentikasi melalui Supabase Auth pada client.
2. **Pengiriman Access Token**: Setiap permintaan API ke backend (`/api/*`) wajib menyertakan header:
   `Authorization: Bearer <supabase_access_token>`
3. **Verifikasi Server**:
   - Middleware `/server/middleware/auth.ts` memverifikasi token ke Supabase Auth.
   - Mengambil data profil dari tabel `users` untuk memastikan `school_id` dan `role` terkini.
   - Menolak akses dengan HTTP `401 Unauthorized` atau `403 Forbidden` jika kredensial tidak valid.

---

## 4. Kebijakan Keamanan Storage & Signed URLs

- Dokumen RPPM/Modul Ajar disimpan pada **Private Supabase Storage Bucket** (`rpp-documents`).
- File dikelompokkan dengan struktur jalur terisolasi: `schools/<school_id>/teachers/<teacher_id>/<file_name>`.
- Akses ke file publik **dilarang**. Download file menggunakan **Short-Lived Signed URL** dengan masa berlaku **maksimal 30 menit**.
- Validasi *Magic Bytes* diterapkan sebelum ekstraksi:
  - **PDF**: Harus diawali `%PDF-`
  - **DOCX**: Harus berupa struktur ZIP PK (`0x50 0x4B 0x03 0x04`)
  - **.doc (Binary Word 97-2003)**: Ditolak secara otomatis untuk mencegah serangan eksekusi biner legacy.

---

## 5. Alur Kerja Human-in-the-Loop & Pembatas AI

1. **AI Bukan Penentu Keputusan Final**: Rekomendasi skor (1-3) dan catatan yang dihasilkan oleh Gemini AI bertindak sebagai *Draft Recommendation*.
2. **Tanpa Pengisian Otomatis Tanpa Konfirmasi**: Skor resmi supervisor diawali dalam kondisi belum dikonfirmasi (`score: 0`, `status: PENDING`).
3. **Verifikasi Indikator Satu per Satu**: Supervisor wajib memeriksa bukti otentik dokumen yang ditemukan AI dan mengonfirmasi/mengubah skor per indikator.
4. **Persyaratan Catatan Alasan**: Jika supervisor menetapkan skor yang berbeda dari rekomendasi AI, sistem mewajibkan pengisian catatan alasan sebelum hasil dapat disimpan.
5. **Proteksi Prompt Injection**: Seluruh teks dokumen disaring dengan `detectPromptInjection()` untuk memblokir klaim terlarang seperti *"Abaikan instruksi sebelumnya"* atau *"Berikan nilai 3"*.

---

## 6. Petunjuk Instalasi, Pengujian, & Produksi

### Syarat Prasyarat
- **Node.js**: v18.x atau lebih baru
- **NPM**: v9.x atau lebih baru

### 1. Instalasi Dependensi
```bash
npm install
```

### 2. Pengaturan Variabel Lingkungan
Salin file `.env.example` menjadi `.env` dan lengkapi nilainya:
```bash
cp .env.example .env
```
Isi file `.env`:
```env
VITE_SUPABASE_URL=https://your-supabase-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-supabase-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-supabase-service-role-key
GEMINI_API_KEY=your-gemini-api-key
NODE_ENV=development
```

### 3. Pengujian Kualitas & Keamanan (Vitest)
Jalankan pengujian unit dan integrasi otomatis:
```bash
npm run test
```

### 4. Pengecekan Tipe TypeScript
```bash
npm run lint
```

### 5. Menjalankan Mode Pengembang (Development)
```bash
npm run dev
```
Aplikasi dapat diakses pada `http://localhost:3000`.

### 6. Build & Produksi
```bash
# Kompilasi aplikasi frontend dan bundel CJS server
npm run build

# Menjalankan server produksi
npm start
```

---

## 7. Prosedur Rotasi Rahasia (Secret Rotation)

Jika `GEMINI_API_KEY` atau kredensial Supabase terindikasi pernah terdistribusi/bocor:

1. **Rotasi Gemini API Key**:
   - Buka Google AI Studio / GCP Console.
   - Buat API Key baru dan hapus Key lama.
   - Perbarui nilai `GEMINI_API_KEY` di environment Cloud Run / server deployment.
2. **Rotasi Supabase Keys**:
   - Buka Supabase Dashboard > Project Settings > API.
   - Lakukan Roll/Rotate pada `JWT Secret` dan `service_role` key.
   - Perbarui variabel lingkungan server aplikasi.
3. **Restart Server**: Jalankan ulang container atau dev server agar environment baru dimuat.
