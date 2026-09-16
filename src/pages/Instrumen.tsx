import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { db } from '../lib/db';
import { Instrument, InstrumentItem, InstrumentSection, InstrumentType } from '../types';
import { parseExcelInstrument } from '../lib/excelParser';
import { Card } from '../components/common/Card';
import { Badge } from '../components/common/Badge';
import { Modal } from '../components/common/Modal';
import { useToast } from '../components/common/Toast';
import {
  SlidersHorizontal,
  Plus,
  Edit3,
  Trash2,
  FileSpreadsheet,
  ToggleLeft,
  ToggleRight,
  GitBranch,
  CheckCircle2,
  ListPlus,
  Sliders,
} from 'lucide-react';

export const Instrumen: React.FC = () => {
  const { role } = useAuth();
  const { showToast } = useToast();
  const [instruments, setInstruments] = useState<Instrument[]>([]);
  const [activeTab, setActiveTab] = useState<InstrumentType>('RPPM');
  const [selectedInst, setSelectedInst] = useState<Instrument | null>(null);

  // Modals
  const [isVersionModalOpen, setIsVersionModalOpen] = useState(false);
  const [isIndicatorModalOpen, setIsIndicatorModalOpen] = useState(false);
  const [isSectionModalOpen, setIsSectionModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);

  // Section Form state
  const [editingSection, setEditingSection] = useState<InstrumentSection | null>(null);
  const [sectionForm, setSectionForm] = useState({
    title: '',
    weight: 25,
  });

  // Indicator Form state
  const [editingItem, setEditingItem] = useState<InstrumentItem | null>(null);
  const [selectedSectionId, setSelectedSectionId] = useState('');
  const [indicatorForm, setIndicatorForm] = useState({
    code: '',
    indicator: '',
    description: '',
    min_score: 1,
    max_score: 4,
    is_active: true,
  });

  // Version Form state
  const [versionForm, setVersionForm] = useState({
    title: '',
    description: '',
    version: 'v2.0',
  });

  // File import state
  const [importFile, setImportFile] = useState<File | null>(null);
  const [isImporting, setIsImporting] = useState(false);

  useEffect(() => {
    const loadData = () => {
      const data = db.getInstruments();
      setInstruments(data);
      const match = data.find((i) => i.type === activeTab);
      if (match) setSelectedInst(match);
    };

    loadData();
    return db.subscribe(loadData);
  }, [activeTab]);

  const handleTabChange = (type: InstrumentType) => {
    setActiveTab(type);
    const match = instruments.find((i) => i.type === type);
    if (match) setSelectedInst(match);
  };

  // Toggle active state of indicator
  const handleToggleActive = (itemId: string, currentStatus: boolean) => {
    if (!selectedInst) return;
    db.updateInstrumentItem(selectedInst.id, itemId, { is_active: !currentStatus });
    showToast('Status Diperbarui', `Indikator berhasil ${!currentStatus ? 'diaktifkan' : 'dinonaktifkan'}.`, 'success');
  };

  // Delete indicator
  const handleDeleteIndicator = (itemId: string) => {
    if (!selectedInst) return;
    if (confirm('Apakah Anda yakin ingin menghapus indikator ini?')) {
      db.deleteInstrumentItem(selectedInst.id, itemId);
      showToast('Dihapus', 'Indikator instrumen telah dihapus.', 'success');
    }
  };

  // Open Indicator Modal
  const handleOpenAddIndicator = (sectionId: string) => {
    setSelectedSectionId(sectionId);
    setEditingItem(null);
    setIndicatorForm({
      code: `IND-${Date.now().toString().slice(-4)}`,
      indicator: '',
      description: '',
      min_score: 1,
      max_score: 4,
      is_active: true,
    });
    setIsIndicatorModalOpen(true);
  };

  const handleOpenEditIndicator = (sectionId: string, item: InstrumentItem) => {
    setSelectedSectionId(sectionId);
    setEditingItem(item);
    setIndicatorForm({
      code: item.code,
      indicator: item.indicator,
      description: item.description,
      min_score: item.min_score,
      max_score: item.max_score,
      is_active: item.is_active,
    });
    setIsIndicatorModalOpen(true);
  };

  const handleSaveIndicator = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedInst || !selectedSectionId || !indicatorForm.indicator) return;

    if (editingItem) {
      db.updateInstrumentItem(selectedInst.id, editingItem.id, indicatorForm);
      showToast('Berhasil', 'Indikator instrumen diperbarui.', 'success');
    } else {
      db.addInstrumentItem(selectedInst.id, selectedSectionId, {
        ...indicatorForm,
        sort_order: 99,
      });
      showToast('Berhasil', 'Indikator instrumen baru ditambahkan.', 'success');
    }

    setIsIndicatorModalOpen(false);
  };

  // Section CRUD Handlers
  const handleOpenAddSection = () => {
    setEditingSection(null);
    setSectionForm({ title: '', weight: 25 });
    setIsSectionModalOpen(true);
  };

  const handleOpenEditSection = (sec: InstrumentSection) => {
    setEditingSection(sec);
    setSectionForm({ title: sec.title, weight: sec.weight });
    setIsSectionModalOpen(true);
  };

  const handleDeleteSection = (secId: string, title: string) => {
    if (!selectedInst) return;
    if (confirm(`Apakah Anda yakin ingin menghapus bagian "${title}" beserta seluruh indikatornya?`)) {
      db.deleteInstrumentSection(selectedInst.id, secId);
      showToast('Dihapus', `Bagian "${title}" telah dihapus.`, 'success');
    }
  };

  const handleSaveSection = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedInst || !sectionForm.title) return;

    if (editingSection) {
      db.updateInstrumentSection(selectedInst.id, editingSection.id, {
        title: sectionForm.title,
        weight: Number(sectionForm.weight),
      });
      showToast('Berhasil', 'Bagian instrumen berhasil diperbarui.', 'success');
    } else {
      db.addInstrumentSection(selectedInst.id, {
        title: sectionForm.title,
        weight: Number(sectionForm.weight),
        sort_order: (selectedInst.sections?.length || 0) + 1,
        items: [],
      });
      showToast('Berhasil', 'Bagian instrumen baru ditambahkan.', 'success');
    }
    setIsSectionModalOpen(false);
  };

  // Save new Version of Instrument
  const handleCreateVersion = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedInst) return;

    const newInst = db.addInstrument({
      type: selectedInst.type,
      title: versionForm.title || selectedInst.title,
      description: versionForm.description || selectedInst.description,
      version: versionForm.version,
      is_active: true,
      sections: selectedInst.sections, // Duplicate existing sections
      school_id: db.getSchool().id,
    });

    // Deactivate previous versions
    instruments
      .filter((i) => i.type === selectedInst.type && i.id !== newInst.id)
      .forEach((i) => db.updateInstrument(i.id, { is_active: false }));

    setSelectedInst(newInst);
    showToast('Versi Baru Dibuat', `Instrumen ${versionForm.version} berhasil dibuat.`, 'success');
    setIsVersionModalOpen(false);
  };

  // Import Excel Handler
  const handleImportExcel = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!importFile || !selectedInst) return;

    try {
      setIsImporting(true);
      const parsedSections = await parseExcelInstrument(importFile);

      // Create new version with imported sections
      const newSections: InstrumentSection[] = parsedSections.map((secGroup, secIdx) => ({
        id: `sec-imp-${Date.now()}-${secIdx}`,
        instrument_id: selectedInst.id,
        title: secGroup.sectionTitle,
        weight: 100 / parsedSections.length,
        sort_order: secIdx + 1,
        created_at: new Date().toISOString(),
        items: secGroup.items.map((item, itemIdx) => ({
          id: `itm-imp-${Date.now()}-${secIdx}-${itemIdx}`,
          section_id: `sec-imp-${Date.now()}-${secIdx}`,
          code: item.code,
          indicator: item.indicator,
          description: item.description,
          min_score: item.minScore,
          max_score: item.maxScore,
          is_active: true,
          sort_order: itemIdx + 1,
          created_at: new Date().toISOString(),
        })),
      }));

      // Update instrument
      db.updateInstrument(selectedInst.id, { sections: newSections });
      showToast('Import Berhasil', `${parsedSections.length} bagian & indikator di-import dari Excel.`, 'success');
      setIsImportModalOpen(false);
      setImportFile(null);
    } catch (err: any) {
      showToast('Gagal Import', err.message || 'Format file Excel tidak sesuai.', 'error');
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-extrabold text-slate-800 flex items-center gap-2">
            <SlidersHorizontal className="w-5 h-5 text-emerald-600" />
            <span>Pengelolaan Struktur Instrumen Dinamis</span>
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Indikator tersimpan di database dan dapat ditambah, diubah, disesuaikan skornya, serta di-import dari Excel.
          </p>
        </div>

        {role === 'ADMIN' && (
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => {
                setImportFile(null);
                setIsImportModalOpen(true);
              }}
              className="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition-colors flex items-center gap-2 border border-slate-200"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
              <span>Import Excel</span>
            </button>
            <button
              onClick={() => {
                if (selectedInst) {
                  setVersionForm({
                    title: selectedInst.title,
                    description: selectedInst.description,
                    version: `v${(parseFloat(selectedInst.version.replace('v', '')) + 0.1).toFixed(1)}`,
                  });
                }
                setIsVersionModalOpen(true);
              }}
              className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-md shadow-emerald-600/20 transition-all flex items-center gap-2"
            >
              <GitBranch className="w-4 h-4" />
              <span>Buat Versi Baru</span>
            </button>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
        <button
          onClick={() => handleTabChange('RPPM')}
          className={`px-4 py-2.5 rounded-xl font-bold text-xs transition-all flex items-center gap-2 ${
            activeTab === 'RPPM'
              ? 'bg-slate-900 text-white shadow-sm'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Sliders className="w-4 h-4 text-emerald-400" />
          <span>Instrumen Telaah RPPM</span>
        </button>
        <button
          onClick={() => handleTabChange('SUPERVISI_PEMBELAJARAN')}
          className={`px-4 py-2.5 rounded-xl font-bold text-xs transition-all flex items-center gap-2 ${
            activeTab === 'SUPERVISI_PEMBELAJARAN'
              ? 'bg-slate-900 text-white shadow-sm'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Sliders className="w-4 h-4 text-sky-400" />
          <span>Instrumen Supervisi Pembelajaran</span>
        </button>
      </div>

      {/* Selected Instrument Header Banner */}
      {selectedInst && (
        <Card className="bg-slate-50/50 border-emerald-200/80">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Badge variant={selectedInst.is_active ? 'success' : 'neutral'}>
                  {selectedInst.is_active ? 'Versi Aktif' : 'Arsip/Nonaktif'}
                </Badge>
                <span className="text-xs font-mono font-bold text-slate-500">
                  {selectedInst.version}
                </span>
              </div>
              <h3 className="text-base font-extrabold text-slate-800">{selectedInst.title}</h3>
              <p className="text-xs text-slate-500 mt-1">{selectedInst.description}</p>
            </div>

            <div className="flex items-center gap-3 shrink-0">
              <span className="text-xs text-slate-400">
                Terakhir diperbarui: {new Date(selectedInst.updated_at).toLocaleDateString('id-ID')}
              </span>
              {role === 'ADMIN' && (
                <button
                  type="button"
                  onClick={handleOpenAddSection}
                  className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-xs transition-all flex items-center gap-1.5"
                >
                  <ListPlus className="w-4 h-4" />
                  <span>Tambah Bagian / Kategori</span>
                </button>
              )}
            </div>
          </div>
        </Card>
      )}

      {/* Sections and Items List */}
      {selectedInst && selectedInst.sections && (
        <div className="space-y-6">
          {selectedInst.sections.map((section) => (
            <Card
              key={section.id}
              title={section.title}
              subtitle={`Bobot Kategori: ${section.weight}%`}
              action={
                role === 'ADMIN' && (
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleOpenEditSection(section)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 transition-colors"
                      title="Edit Bagian / Kategori"
                    >
                      <Edit3 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDeleteSection(section.id, section.title)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                      title="Hapus Bagian / Kategori"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleOpenAddIndicator(section.id)}
                      className="px-3 py-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-bold text-xs transition-colors flex items-center gap-1.5"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Tambah Indikator</span>
                    </button>
                  </div>
                )
              }
            >
              <div className="space-y-3">
                {(!section.items || section.items.length === 0) && (
                  <p className="text-xs text-slate-400 py-4 text-center">
                    Belum ada indikator dalam bagian ini.
                  </p>
                )}

                {section.items &&
                  section.items.map((item) => (
                    <div
                      key={item.id}
                      className={`p-4 rounded-xl border transition-all ${
                        item.is_active
                          ? 'bg-white border-slate-200'
                          : 'bg-slate-50 border-slate-200 opacity-60'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="space-y-1 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="px-2 py-0.5 rounded bg-slate-100 font-mono text-[11px] font-bold text-slate-700">
                              {item.code}
                            </span>
                            <Badge variant={item.is_active ? 'success' : 'neutral'} size="sm">
                              Skor Min: {item.min_score} - Maks: {item.max_score}
                            </Badge>
                          </div>

                          <h4 className="text-xs font-bold text-slate-800 pt-1 leading-snug">
                            {item.indicator}
                          </h4>
                          <p className="text-[11px] text-slate-500 leading-relaxed">
                            {item.description}
                          </p>
                        </div>

                        {role === 'ADMIN' && (
                          <div className="flex items-center gap-2 shrink-0">
                            {/* Toggle Active */}
                            <button
                              onClick={() => handleToggleActive(item.id, item.is_active)}
                              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
                              title={item.is_active ? 'Nonaktifkan Indikator' : 'Aktifkan Indikator'}
                            >
                              {item.is_active ? (
                                <ToggleRight className="w-5 h-5 text-emerald-600" />
                              ) : (
                                <ToggleLeft className="w-5 h-5 text-slate-400" />
                              )}
                            </button>

                            {/* Edit */}
                            <button
                              onClick={() => handleOpenEditIndicator(section.id, item)}
                              className="p-1.5 rounded-lg text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 transition-colors"
                              title="Edit Indikator"
                            >
                              <Edit3 className="w-4 h-4" />
                            </button>

                            {/* Delete */}
                            <button
                              onClick={() => handleDeleteIndicator(item.id)}
                              className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                              title="Hapus Indikator"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Modal Add / Edit Indicator */}
      <Modal
        isOpen={isIndicatorModalOpen}
        onClose={() => setIsIndicatorModalOpen(false)}
        title={editingItem ? 'Edit Indikator Penilaian' : 'Tambah Indikator Baru'}
        description="Pengaturan skor dan indikator tersimpan langsung ke database instrumen."
      >
        <form onSubmit={handleSaveIndicator} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Kode Indikator</label>
              <input
                type="text"
                value={indicatorForm.code}
                onChange={(e) => setIndicatorForm({ ...indicatorForm, code: e.target.value })}
                required
                className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Status Indikator</label>
              <select
                value={indicatorForm.is_active ? 'true' : 'false'}
                onChange={(e) =>
                  setIndicatorForm({ ...indicatorForm, is_active: e.target.value === 'true' })
                }
                className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs"
              >
                <option value="true">Aktif</option>
                <option value="false">Nonaktif</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Pernyataan Indikator *</label>
            <textarea
              rows={2}
              value={indicatorForm.indicator}
              onChange={(e) => setIndicatorForm({ ...indicatorForm, indicator: e.target.value })}
              required
              className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs"
              placeholder="Contoh: Kejelasan perumusan tujuan pembelajaran..."
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Deskripsi / Rubrik Penilaian</label>
            <textarea
              rows={2}
              value={indicatorForm.description}
              onChange={(e) => setIndicatorForm({ ...indicatorForm, description: e.target.value })}
              className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs"
              placeholder="Petunjuk khusus bagi supervisor saat memberikan penilaian..."
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Skor Minimum</label>
              <input
                type="number"
                min={0}
                max={10}
                value={indicatorForm.min_score}
                onChange={(e) => setIndicatorForm({ ...indicatorForm, min_score: Number(e.target.value) })}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Skor Maksimum</label>
              <input
                type="number"
                min={1}
                max={100}
                value={indicatorForm.max_score}
                onChange={(e) => setIndicatorForm({ ...indicatorForm, max_score: Number(e.target.value) })}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs"
              />
            </div>
          </div>

          <div className="pt-4 flex justify-end gap-2 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setIsIndicatorModalOpen(false)}
              className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-600"
            >
              Batal
            </button>
            <button
              type="submit"
              className="px-4 py-2 rounded-xl bg-emerald-600 text-white font-bold text-xs shadow-md shadow-emerald-600/20"
            >
              Simpan Indikator
            </button>
          </div>
        </form>
      </Modal>

      {/* Modal Add / Edit Section */}
      <Modal
        isOpen={isSectionModalOpen}
        onClose={() => setIsSectionModalOpen(false)}
        title={editingSection ? 'Edit Bagian / Kategori' : 'Tambah Bagian / Kategori Baru'}
        description="Bagian digunakan untuk mengelompokkan indikator penilaian supervisi."
      >
        <form onSubmit={handleSaveSection} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Judul Bagian / Kategori *</label>
            <input
              type="text"
              value={sectionForm.title}
              onChange={(e) => setSectionForm({ ...sectionForm, title: e.target.value })}
              required
              className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs focus:ring-2 focus:ring-emerald-500"
              placeholder="Contoh: A. Perencanaan Pembelajaran"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Bobot Penilaian (%) *</label>
            <input
              type="number"
              min={1}
              max={100}
              value={sectionForm.weight}
              onChange={(e) => setSectionForm({ ...sectionForm, weight: Number(e.target.value) })}
              required
              className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          <div className="pt-4 flex justify-end gap-2 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setIsSectionModalOpen(false)}
              className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50"
            >
              Batal
            </button>
            <button
              type="submit"
              className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-md shadow-emerald-600/20"
            >
              Simpan Bagian
            </button>
          </div>
        </form>
      </Modal>

      {/* Modal Create Version */}
      <Modal
        isOpen={isVersionModalOpen}
        onClose={() => setIsVersionModalOpen(false)}
        title="Buat Versi Baru Instrumen"
        description="Membuat salinan instrumen sebagai versi baru tanpa mengubah data evaluasi sebelumnya."
      >
        <form onSubmit={handleCreateVersion} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Nomor Versi *</label>
            <input
              type="text"
              value={versionForm.version}
              onChange={(e) => setVersionForm({ ...versionForm, version: e.target.value })}
              required
              className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-mono"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Judul Instrumen</label>
            <input
              type="text"
              value={versionForm.title}
              onChange={(e) => setVersionForm({ ...versionForm, title: e.target.value })}
              className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Deskripsi Versi</label>
            <textarea
              rows={2}
              value={versionForm.description}
              onChange={(e) => setVersionForm({ ...versionForm, description: e.target.value })}
              className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs"
            />
          </div>

          <div className="pt-4 flex justify-end gap-2 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setIsVersionModalOpen(false)}
              className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-600"
            >
              Batal
            </button>
            <button
              type="submit"
              className="px-4 py-2 rounded-xl bg-emerald-600 text-white font-bold text-xs shadow-md shadow-emerald-600/20"
            >
              Terbitkan Versi
            </button>
          </div>
        </form>
      </Modal>

      {/* Modal Import Excel */}
      <Modal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        title="Import Indikator dari File Excel"
        description="Unggah file .xlsx untuk memperbarui struktur indikator secara otomatis."
      >
        <form onSubmit={handleImportExcel} className="space-y-4">
          <div className="p-4 rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 text-center">
            <FileSpreadsheet className="w-8 h-8 text-emerald-600 mx-auto mb-2" />
            <p className="text-xs font-bold text-slate-700 mb-1">Pilih File Excel (.xlsx / .xls)</p>
            <p className="text-[11px] text-slate-500 mb-3">
              Format Kolom: [Bagian, Kode, Indikator, Deskripsi/Rubrik, Skor Min, Skor Maks]
            </p>
            <input
              type="file"
              accept=".xlsx,.xls,.csv"
              onChange={(e) => setImportFile(e.target.files?.[0] || null)}
              className="text-xs text-slate-600"
            />
          </div>

          {importFile && (
            <p className="text-xs font-bold text-emerald-700 flex items-center gap-1">
              <CheckCircle2 className="w-4 h-4" />
              File terpilih: {importFile.name}
            </p>
          )}

          <div className="pt-4 flex justify-end gap-2 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setIsImportModalOpen(false)}
              className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-600"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={!importFile || isImporting}
              className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-md disabled:opacity-50"
            >
              {isImporting ? 'Memproses...' : 'Import Data'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
