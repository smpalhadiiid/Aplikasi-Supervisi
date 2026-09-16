import React, { useRef, useState } from 'react';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { RppReview, Supervision, Instrument, Teacher } from '../../types';
import { db } from '../../lib/db';
import { triggerPrint } from '../../lib/print';
import { Modal } from './Modal';
import { Printer, Download, X, Image as ImageIcon, CheckCircle, Award } from 'lucide-react';

interface LembarRincianNilaiModalProps {
  isOpen: boolean;
  onClose: () => void;
  type: 'RPPM' | 'SUPERVISION';
  data: RppReview | Supervision | null;
}

export const LembarRincianNilaiModal: React.FC<LembarRincianNilaiModalProps> = ({
  isOpen,
  onClose,
  type,
  data,
}) => {
  const [isExporting, setIsExporting] = useState(false);
  const printRef = useRef<HTMLDivElement>(null);

  if (!isOpen || !data) return null;

  const school = db.getSchool();
  const teachers = db.getTeachers();
  const instruments = db.getInstruments();

  const teacher = teachers.find((t) => t.id === data.teacher_id);
  const teacherName = data.teacher_name || teacher?.full_name || 'Guru';
  const teacherNip = teacher?.nip || '-';
  const supervisorName = data.supervisor_name || 'Supervisor / Penilai';

  // Find corresponding instrument sections and items
  const instType = type === 'RPPM' ? 'RPPM' : 'SUPERVISI_PEMBELAJARAN';
  const inst = instruments.find((i) => i.id === data.instrument_id) ||
    instruments.find((i) => i.type === instType);

  const sections = inst?.sections || [];

  const isRpp = type === 'RPPM';
  const rppData = isRpp ? (data as RppReview) : null;
  const supData = !isRpp ? (data as Supervision) : null;

  const title = isRpp
    ? 'LEMBAR RINCIAN NILAI TELAAH RPPM'
    : 'LEMBAR RINCIAN NILAI SUPERVISI PEMBELAJARAN';

  const subtitle = isRpp
    ? 'Evaluasi Rencana Pembelajaran Mendalam (Mindful, Meaningful, & Joyful Learning)'
    : 'Observasi Pelaksanaan Pembelajaran Deep Learning Pedagogy';

  const dateFormatted = new Date(
    isRpp ? rppData?.review_date || data.created_at : supData?.supervision_date || data.created_at
  ).toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  const photos = supData?.photos || [];

  // Helper score mapping for individual items
  const getItemScore = (itemId: string) => {
    if (isRpp && rppData?.items) {
      const found = rppData.items.find((i) => i.item_id === itemId);
      return {
        score: found ? found.score : 0,
        notes: found ? found.notes || found.ai_revision_note || '' : '',
        aiScore: found?.ai_recommendation_score,
      };
    } else if (!isRpp && supData?.items) {
      const found = supData.items.find((i) => i.item_id === itemId);
      return {
        score: found ? found.score : 0,
        notes: found ? found.notes || '' : '',
      };
    }
    return { score: 0, notes: '' };
  };

  const handleDownloadPdf = async () => {
    if (!printRef.current) return;
    try {
      setIsExporting(true);

      const parseColorToRgb = (colorStr: string): string => {
        try {
          const tempEl = document.createElement('div');
          tempEl.style.color = colorStr;
          document.body.appendChild(tempEl);
          const computed = window.getComputedStyle(tempEl).color;
          document.body.removeChild(tempEl);
          if (computed && !computed.includes('oklch') && !computed.includes('oklab')) {
            return computed;
          }
        } catch {
          // ignore error
        }
        return '#000000';
      };

      const canvas = await html2canvas(printRef.current, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff',
        onclone: (clonedDoc) => {
          // 1. Sanitize all <style> tags in cloned DOM to replace oklch/oklab(...) with resolved rgb/hex
          const styleEls = Array.from(clonedDoc.querySelectorAll('style'));
          styleEls.forEach((styleEl) => {
            if (styleEl.textContent && /(oklch|oklab|lab|lch)\([^)]+\)/i.test(styleEl.textContent)) {
              styleEl.textContent = styleEl.textContent.replace(/(oklch|oklab|lab|lch)\([^)]+\)/gi, (match) => {
                return parseColorToRgb(match);
              });
            }
          });

          // 2. Sanitize inline style attributes & computed styles of cloned elements
          const colorProps = ['color', 'background-color', 'border-color', 'outline-color', 'fill', 'stroke'];
          const allElements = Array.from(clonedDoc.querySelectorAll('*'));

          allElements.forEach((el) => {
            const htmlEl = el as HTMLElement;
            const styleAttr = htmlEl.getAttribute?.('style');
            if (styleAttr && /(oklch|oklab|lab|lch)\([^)]+\)/i.test(styleAttr)) {
              htmlEl.setAttribute(
                'style',
                styleAttr.replace(/(oklch|oklab|lab|lch)\([^)]+\)/gi, (match) => parseColorToRgb(match))
              );
            }

            if (clonedDoc.defaultView) {
              const computed = clonedDoc.defaultView.getComputedStyle(htmlEl);
              colorProps.forEach((prop) => {
                const val = computed.getPropertyValue(prop);
                if (val && /(oklch|oklab|lab|lch)\([^)]+\)/i.test(val)) {
                  htmlEl.style.setProperty(prop, parseColorToRgb(val));
                }
              });
            }
          });
        },
      });

      const imgData = canvas.toDataURL('image/jpeg', 0.95);
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
      });

      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      const imgWidth = canvas.width;
      const imgHeight = canvas.height;

      const pageImgHeight = (imgHeight * pdfWidth) / imgWidth;

      if (pageImgHeight <= pdfHeight) {
        // Single page fit
        pdf.addImage(imgData, 'JPEG', 0, 0, pdfWidth, pageImgHeight);
      } else {
        // Multi-page slicing for longer documents
        let heightLeft = pageImgHeight;
        let position = 0;

        pdf.addImage(imgData, 'JPEG', 0, position, pdfWidth, pageImgHeight);
        heightLeft -= pdfHeight;

        while (heightLeft > 0) {
          position -= pdfHeight;
          pdf.addPage();
          pdf.addImage(imgData, 'JPEG', 0, position, pdfWidth, pageImgHeight);
          heightLeft -= pdfHeight;
        }
      }

      const filename = `Lembar_Nilai_${type}_${teacherName.replace(/\s+/g, '_')}_${data.semester}_${data.academic_year.replace('/', '-')}.pdf`;
      pdf.save(filename);
    } catch (err) {
      console.error('Failed generating PDF:', err);
      alert('Gagal mengunduh PDF. Silakan gunakan tombol Cetak.');
    } finally {
      setIsExporting(false);
    }
  };

  const handlePrint = () => {
    triggerPrint();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title} maxWidth="max-w-5xl">
      {/* Top Action Bar (hidden in print mode) */}
      <div className="no-print mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-slate-50 p-3 rounded-lg">
        <div className="text-xs text-slate-600">
          <span className="font-semibold text-slate-800">Tips:</span> Lembar Rincian Nilai ini diformat khusus A4 dan siap untuk dicetak atau diunduh PDF.
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleDownloadPdf}
            disabled={isExporting}
            className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 transition shadow-sm disabled:opacity-50"
          >
            <Download className="h-4 w-4" />
            {isExporting ? 'Memproses PDF...' : 'Unduh PDF'}
          </button>
          <button
            onClick={handlePrint}
            className="inline-flex items-center gap-1.5 rounded-lg bg-slate-800 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-900 transition shadow-sm"
          >
            <Printer className="h-4 w-4" />
            Cetak (Print)
          </button>
        </div>
      </div>

      {/* PRINTABLE DOCUMENT AREA */}
      <div className="bg-white text-slate-900 p-4 sm:p-8 rounded-lg shadow-sm font-sans" ref={printRef} id="lembar-rincian-cetak">
        {/* KOP SURAT SEKOLAH */}
        <div className="text-center pb-4 mb-4 border-b-4 border-double border-slate-900">
          <h2 className="text-xl sm:text-2xl font-bold uppercase tracking-wide text-slate-900">
            {school.name || 'DINAS PENDIDIKAN & KEBUDAYAAN'}
          </h2>
          <p className="text-xs sm:text-sm font-medium text-slate-700">
            {school.address || 'Alamat Sekolah / Instansi Pendidikan'}
          </p>
          <p className="text-xs text-slate-600">
            NPSN: <span className="font-semibold">{school.npsn || '12345678'}</span> | Telepon / Email: Supel-Learning App
          </p>
        </div>

        {/* DOKUMEN HEADER */}
        <div className="text-center my-4">
          <h1 className="text-lg sm:text-xl font-bold uppercase underline text-slate-900 tracking-tight">
            {title}
          </h1>
          <p className="text-xs sm:text-sm italic text-slate-600 mt-1">{subtitle}</p>
        </div>

        {/* TABEL IDENTITAS GURU & PELAKSANAAN */}
        <div className="my-6 rounded-md border border-slate-300 p-4 bg-slate-50/50">
          <table className="w-full text-xs sm:text-sm">
            <tbody>
              <tr className="border-b border-slate-200">
                <td className="py-1.5 font-semibold text-slate-700 w-1/4">Nama Guru</td>
                <td className="py-1.5 font-bold text-slate-900 w-1/4">: {teacherName}</td>
                <td className="py-1.5 font-semibold text-slate-700 w-1/4">Tahun Ajaran / Sem</td>
                <td className="py-1.5 text-slate-900 w-1/4">: {data.academic_year} ({data.semester})</td>
              </tr>
              <tr className="border-b border-slate-200">
                <td className="py-1.5 font-semibold text-slate-700">NIP / NIK</td>
                <td className="py-1.5 text-slate-900">: {teacherNip}</td>
                <td className="py-1.5 font-semibold text-slate-700">Mata Pelajaran</td>
                <td className="py-1.5 text-slate-900">: {data.subject}</td>
              </tr>
              <tr className="border-b border-slate-200">
                <td className="py-1.5 font-semibold text-slate-700">Kelas / Tingkat</td>
                <td className="py-1.5 text-slate-900">: {data.class_grade}</td>
                <td className="py-1.5 font-semibold text-slate-700">Topik Pembelajaran</td>
                <td className="py-1.5 text-slate-900">: {data.topic}</td>
              </tr>
              <tr>
                <td className="py-1.5 font-semibold text-slate-700">Supervisor / Penilai</td>
                <td className="py-1.5 text-slate-900">: {supervisorName}</td>
                <td className="py-1.5 font-semibold text-slate-700">Tanggal Penilaian</td>
                <td className="py-1.5 text-slate-900">: {dateFormatted}</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* TABEL RINCIAN NILAI PER INDIKATOR */}
        <div className="my-6">
          <h3 className="text-sm font-bold uppercase text-slate-900 mb-2 border-l-4 border-slate-900 pl-2">
            Rincian Indikator Penilaian
          </h3>

          <div className="overflow-x-auto">
            <table className="w-full border-collapse border border-slate-300 text-xs text-left">
              <thead>
                <tr className="bg-slate-100 text-slate-900 font-bold border-b border-slate-300">
                  <th className="border border-slate-300 px-2 py-2 text-center w-10">No</th>
                  <th className="border border-slate-300 px-2 py-2 w-16 text-center">Kode</th>
                  <th className="border border-slate-300 px-3 py-2">Indikator & Deskripsi Aspek</th>
                  <th className="border border-slate-300 px-2 py-2 text-center w-16">Skor Maks</th>
                  <th className="border border-slate-300 px-2 py-2 text-center w-20">Skor Perolehan</th>
                  <th className="border border-slate-300 px-3 py-2">Catatan / Bukti Evaluasi</th>
                </tr>
              </thead>
              <tbody>
                {sections.length > 0 ? (
                  sections.map((sec, secIdx) => (
                    <React.Fragment key={sec.id || secIdx}>
                      {/* Section Header Row */}
                      <tr className="bg-slate-200/70 font-bold text-slate-900">
                        <td colSpan={6} className="border border-slate-300 px-3 py-1.5 uppercase">
                          {String.fromCharCode(65 + secIdx)}. {sec.title}
                        </td>
                      </tr>
                      {sec.items?.map((item, itemIdx) => {
                        const { score, notes } = getItemScore(item.id);
                        return (
                          <tr key={item.id} className="hover:bg-slate-50 border-b border-slate-200">
                            <td className="border border-slate-300 px-2 py-2 text-center font-medium">
                              {itemIdx + 1}
                            </td>
                            <td className="border border-slate-300 px-2 py-2 text-center font-mono font-semibold text-slate-700">
                              {item.code || `I-${itemIdx + 1}`}
                            </td>
                            <td className="border border-slate-300 px-3 py-2">
                              <div className="font-semibold text-slate-900">{item.indicator}</div>
                              {item.description && (
                                <div className="text-[11px] text-slate-600 mt-0.5">{item.description}</div>
                              )}
                            </td>
                            <td className="border border-slate-300 px-2 py-2 text-center font-semibold text-slate-700">
                              {item.max_score || (isRpp ? 3 : 4)}
                            </td>
                            <td className="border border-slate-300 px-2 py-2 text-center font-bold text-slate-900">
                              <span
                                className={`inline-block px-2 py-0.5 rounded ${
                                  score >= (item.max_score || 3) * 0.8
                                    ? 'bg-emerald-100 text-emerald-800'
                                    : score >= (item.max_score || 3) * 0.5
                                    ? 'bg-amber-100 text-amber-800'
                                    : 'bg-rose-100 text-rose-800'
                                }`}
                              >
                                {score}
                              </span>
                            </td>
                            <td className="border border-slate-300 px-3 py-2 text-slate-700 italic text-[11px]">
                              {notes || '-'}
                            </td>
                          </tr>
                        );
                      })}
                    </React.Fragment>
                  ))
                ) : (
                  <tr>
                    <td colSpan={6} className="border border-slate-300 px-3 py-4 text-center text-slate-500">
                      Rincian indikator instrumen belum dimuat.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* RINGKASAN SKOR & PREDIKAT */}
        <div className="my-6 grid grid-cols-1 sm:grid-cols-3 gap-4 border border-slate-300 p-4 rounded-md bg-slate-50">
          <div className="text-center sm:text-left">
            <span className="text-xs uppercase font-semibold text-slate-600 block">Total Skor Perolehan</span>
            <span className="text-xl font-bold text-slate-900">
              {data.total_score} / {data.max_possible_score}
            </span>
          </div>

          <div className="text-center">
            <span className="text-xs uppercase font-semibold text-slate-600 block">Persentase Nilai Akhir</span>
            <span className="text-2xl font-black text-emerald-700">
              {data.percentage_score}%
            </span>
          </div>

          <div className="text-center sm:text-right">
            <span className="text-xs uppercase font-semibold text-slate-600 block">Predikat Kualitatif</span>
            <span className="inline-block px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-slate-900 text-white mt-1">
              {data.predicate || 'BAIK'}
            </span>
          </div>
        </div>

        {/* CATATAN UMUM & REKOMENDASI */}
        {data.general_notes && (
          <div className="my-6 border border-slate-300 p-4 rounded-md bg-white">
            <h4 className="text-xs font-bold uppercase text-slate-700 mb-1">
              Catatan Umum & Masukan Evaluator:
            </h4>
            <p className="text-xs sm:text-sm text-slate-800 whitespace-pre-line leading-relaxed">
              {data.general_notes}
            </p>
          </div>
        )}

        {/* LAMPIRAN FOTO DOKUMENTASI SUPERVISI (User Requirement #2) */}
        {!isRpp && photos && photos.length > 0 && (
          <div className="my-6 border border-slate-300 p-4 rounded-md bg-white page-break-inside-avoid">
            <h4 className="text-xs font-bold uppercase text-slate-900 mb-3 flex items-center gap-1.5 border-b pb-2 border-slate-200">
              <ImageIcon className="h-4 w-4 text-emerald-600" />
              Lampiran Foto Dokumentasi Observasi Supervisi ({photos.length} Foto)
            </h4>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {photos.map((imgUrl, pIdx) => (
                <div key={pIdx} className="border border-slate-200 rounded-md p-1 bg-slate-50">
                  <img
                    src={imgUrl}
                    alt={`Dokumentasi Supervisi ${pIdx + 1}`}
                    className="w-full h-36 object-cover rounded"
                  />
                  <p className="text-[10px] text-center text-slate-600 font-medium mt-1">
                    Dokumentasi {pIdx + 1}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* LEMBAR TANDA TANGAN / PENGESAHAN */}
        <div className="mt-8 pt-6 border-t border-slate-300 page-break-inside-avoid">
          <div className="flex justify-between items-start text-xs sm:text-sm text-slate-900">
            <div className="text-center w-5/12">
              <p>Mengetahui,</p>
              <p className="font-semibold">Kepala {school.name || 'Sekolah'}</p>
              <div className="h-20"></div>
              <p className="font-bold underline uppercase">{school.headmaster_name || '................................................'}</p>
              <p className="text-xs text-slate-600">NIP. ................................................</p>
            </div>

            <div className="text-center w-5/12">
              <p>{school.address ? school.address.split(',')[0] : 'Kota'}, {dateFormatted}</p>
              <p className="font-semibold">Supervisor / Penilai</p>
              <div className="h-20"></div>
              <p className="font-bold underline uppercase">{supervisorName}</p>
              <p className="text-xs text-slate-600">NIP. ................................................</p>
            </div>
          </div>
        </div>
      </div>
    </Modal>
  );
};
