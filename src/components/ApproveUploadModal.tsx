import { useState, useRef } from 'react'
import { X, Upload, Camera, Loader2, FileText, Image as ImageIcon } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { getFunctionErrorMessage, sanitizeErrorMessage } from '../lib/functionError'

interface ApproveUploadModalProps {
  namaSurat: string
  isOptional: boolean
  onClose: () => void
  onSuccess: (uploadedItem: any | null) => void
}

export function ApproveUploadModal({ namaSurat, isOptional, onClose, onSuccess }: ApproveUploadModalProps) {
  const [file, setFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10 MB limit for scanned PDF/images

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setErrorMsg('')
    const selected = e.target.files?.[0]
    if (!selected) return
    if (selected.size > MAX_FILE_SIZE) {
      setErrorMsg(`Ukuran file maksimal 10 MB. File kamu: ${(selected.size / 1024 / 1024).toFixed(1)} MB`)
      return
    }
    setFile(selected)
  }

  const handleUpload = async () => {
    if (!file) return
    setUploading(true)
    setErrorMsg('')
    try {
      const base64Content = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve((reader.result as string).split(',')[1])
        reader.onerror = reject
        reader.readAsDataURL(file)
      })

      const ext = file.name.split('.').pop() || 'pdf'
      const finalName = `LAMPIRAN_SEKRETARIS_${namaSurat}_${Date.now()}.${ext}`

      const { data, error } = await supabase.functions.invoke('upload-lampiran', {
        body: {
          fileName: finalName,
          mimeType: file.type,
          base64Content,
          jenisSurat: namaSurat,
          folderId: '1ljdRDiGdc8IVYOO1p0wC09skO3Rg13L1',
        },
      })

      if (error) throw new Error(await getFunctionErrorMessage(error, 'Gagal upload bukti TTD.'))
      if (data?.error) throw new Error(data.error)

      onSuccess({ type: 'file', url: data.url, name: finalName, driveFileId: data.driveFileId })
    } catch (err: any) {
      setErrorMsg(sanitizeErrorMessage(err.message || '', 'Gagal upload bukti TTD.'))
      setUploading(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4"
      style={{ background: 'rgba(10,12,20,0.55)' }}
      onClick={onClose}
    >
      <div
        className="modal-in rounded-3xl w-full max-w-[420px] p-6"
        style={{ background: 'var(--modal-bg)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-center mb-5">
          <h2 className="text-lg font-extrabold" style={{ color: 'var(--text-primary)' }}>Upload Bukti TTD</h2>
          <button onClick={onClose} className="p-2 rounded-full hover:bg-gray-100/10 transition-colors">
            <X size={20} style={{ color: 'var(--text-secondary)' }} />
          </button>
        </div>

        <p className="text-sm mb-4" style={{ color: 'var(--text-secondary)' }}>
          {isOptional 
            ? 'Lampirkan bukti foto/scan fisik dokumen jika ada (Opsional untuk surat Pending).'
            : 'Wajib melampirkan bukti foto/scan fisik dokumen yang sudah ditandatangani sebelum bisa di-Approve.'}
        </p>

        <div
          className="border-2 border-dashed rounded-[16px] p-6 text-center cursor-pointer transition-colors mb-4"
          style={{ borderColor: 'var(--card-border)', background: 'var(--row-bg)' }}
          onClick={() => fileInputRef.current?.click()}
        >
          {file ? (
            <div className="flex flex-col items-center gap-2">
              {file.type.includes('image') ? <ImageIcon size={32} style={{ color: 'var(--accent-maroon)' }} /> : <FileText size={32} style={{ color: 'var(--accent-maroon)' }} />}
              <p className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>{file.name}</p>
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Klik untuk mengganti file</p>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2">
              <Camera size={32} style={{ color: 'var(--text-muted)' }} />
              <p className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>Jepret atau Pilih File</p>
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Mendukung PDF, JPG, PNG (Maks 10MB)</p>
            </div>
          )}
        </div>

        {/* Input file with capture="environment" to trigger camera on mobile */}
        <input
          type="file"
          accept="image/*,application/pdf"
          capture="environment"
          ref={fileInputRef}
          onChange={handleFileChange}
          className="hidden"
        />

        {errorMsg && <p className="text-sm font-semibold mb-4 text-center" style={{ color: '#fb7185' }}>{errorMsg}</p>}

        <div className="flex gap-2">
          {isOptional && (
            <button
              onClick={() => onSuccess(null)}
              disabled={uploading}
              className="btn-outline flex-1 disabled:opacity-50"
            >
              Lewati (Approve Langsung)
            </button>
          )}
          <button
            onClick={handleUpload}
            disabled={!file || uploading}
            className="btn-primary flex-1 flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {uploading ? (
              <>
                <Loader2 size={18} className="animate-spin" /> Uploading...
              </>
            ) : (
              <>
                <Upload size={18} /> Upload & Lanjut
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}