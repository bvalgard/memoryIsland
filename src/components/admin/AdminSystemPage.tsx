import { FormEvent, useEffect, useState } from 'react';
import { Megaphone, RadioTower } from 'lucide-react';
import { addDoc, collection, getDocs, limit, orderBy, query, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '../../firebase';

interface Announcement {
  id: string;
  message: string;
  createdByEmail?: string;
}

export default function AdminSystemPage() {
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);

  const loadAnnouncements = async () => {
    try {
      const announcementsQuery = query(
        collection(db, 'globalAnnouncements'),
        orderBy('createdAt', 'desc'),
        limit(5)
      );
      const snapshot = await getDocs(announcementsQuery);
      setAnnouncements(
        snapshot.docs.map((docSnap) => {
          const data = docSnap.data() as Record<string, any>;
          return {
            id: docSnap.id,
            message: data.message || '',
            createdByEmail: data.createdByEmail,
          };
        })
      );
    } catch (err) {
      console.error('Failed to load announcements', err);
    }
  };

  useEffect(() => {
    void loadAnnouncements();
  }, []);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();

    const trimmed = message.trim();
    if (!trimmed) {
      setError('Please enter a broadcast message before sending it.');
      return;
    }

    if (!auth.currentUser) {
      setError('Session expired. Please sign in again.');
      return;
    }

    setSaving(true);
    setStatus(null);
    setError(null);

    try {
      await addDoc(collection(db, 'globalAnnouncements'), {
        message: trimmed,
        createdAt: serverTimestamp(),
        createdBy: auth.currentUser.uid,
        createdByEmail: auth.currentUser.email,
        isActive: true,
      });

      setMessage('');
      setStatus('Broadcast published to globalAnnouncements.');
      void loadAnnouncements();
    } catch (err) {
      console.error('Failed to publish global announcement', err);
      setError('Could not publish the global announcement.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <section>
      <div className="mb-8">
        <p className="text-[11px] font-black uppercase tracking-[0.24em] text-red-300/80">System & Announcements</p>
        <h2 className="mt-3 text-3xl font-semibold tracking-tight">Send platform-wide broadcasts</h2>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-brand-muted">
          Messages created here are written directly to Firestore so the main app can listen and display them to users.
        </p>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.4fr)_minmax(320px,0.8fr)]">
        <form
          onSubmit={handleSubmit}
          className="rounded-[32px] border border-white/10 bg-[#0B0B0B]/90 p-6 shadow-[0_24px_80px_rgba(0,0,0,0.28)]"
        >
          <div className="mb-6 flex items-center gap-3">
            <div className="rounded-2xl border border-fuchsia-500/20 bg-fuchsia-500/10 p-2 text-fuchsia-300">
              <Megaphone className="h-4 w-4" />
            </div>
            <div>
              <p className="text-sm font-semibold text-white">Global broadcast</p>
              <p className="text-xs text-brand-muted">Write to the `globalAnnouncements` collection.</p>
            </div>
          </div>

          <label className="block text-xs font-black uppercase tracking-[0.18em] text-brand-muted">
            Message
          </label>
          <textarea
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            rows={8}
            placeholder="Example: Scheduled maintenance begins at 11:00 PM MDT. Study sessions may briefly reconnect."
            className="mt-3 w-full rounded-[24px] border border-white/10 bg-white/[0.03] px-4 py-4 text-sm text-white outline-none placeholder:text-brand-muted focus:border-fuchsia-400/40"
          />

          {status && (
            <div className="mt-4 rounded-[20px] border border-emerald-500/20 bg-emerald-500/10 p-4 text-sm text-emerald-100">
              {status}
            </div>
          )}

          {error && (
            <div className="mt-4 rounded-[20px] border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-100">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={saving}
            className="mt-6 inline-flex items-center justify-center rounded-[20px] bg-white px-5 py-3 text-sm font-black uppercase tracking-[0.18em] text-black transition-colors hover:bg-white/90 disabled:opacity-60"
          >
            {saving ? 'Sending...' : 'Publish Broadcast'}
          </button>
        </form>

        <div className="rounded-[32px] border border-white/10 bg-[#0B0B0B]/90 p-6 shadow-[0_24px_80px_rgba(0,0,0,0.28)]">
          <div className="mb-6 flex items-center gap-3">
            <div className="rounded-2xl border border-sky-500/20 bg-sky-500/10 p-2 text-sky-300">
              <RadioTower className="h-4 w-4" />
            </div>
            <div>
              <p className="text-sm font-semibold text-white">Recent broadcasts</p>
              <p className="text-xs text-brand-muted">Most recent records in Firestore.</p>
            </div>
          </div>

          <div className="space-y-3">
            {announcements.length ? (
              announcements.map((announcement) => (
                <div key={announcement.id} className="rounded-[24px] border border-white/10 bg-white/[0.03] p-4">
                  <p className="text-sm leading-relaxed text-white">{announcement.message}</p>
                  <p className="mt-3 text-[11px] uppercase tracking-[0.18em] text-brand-muted">
                    {announcement.createdByEmail || 'Unknown admin'}
                  </p>
                </div>
              ))
            ) : (
              <p className="text-sm text-brand-muted">No broadcasts have been published yet.</p>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
