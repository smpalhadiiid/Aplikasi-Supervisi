# Supabase persistence fix

Perubahan utama:
- Supabase menjadi source of truth setelah user login.
- Tidak lagi melakukan upsert data demo dengan ID seperti `tch-001`, yang tidak valid untuk kolom UUID.
- ID data baru dibuat dengan UUID.
- Guru disimpan ke `teachers`.
- Telaah RPP disimpan ke `rpp_reviews` dan seluruh indikator ke `rpp_review_items`.
- Supervisi disimpan ke `supervisions` dan seluruh indikator ke `supervision_items`.
- Analisis AI disimpan ke `ai_analyses`.
- Rencana tindak lanjut disimpan ke `follow_up_plans`.
- Auth profile menggunakan `public.users`, sesuai schema proyek.
- Setelah login, data sekolah/guru/review/supervisi di-refresh dari Supabase.

## Penting

Pastikan `public.users` memiliki row untuk setiap `auth.users.id` dan `school_id` menunjuk ke row valid di `public.schools`.

Jangan masukkan `SUPABASE_SERVICE_ROLE_KEY` ke frontend.
