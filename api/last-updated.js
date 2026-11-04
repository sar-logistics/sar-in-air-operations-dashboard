// GET /api/last-updated → { lastUpdated: ISO string | null }
// When fresh data last arrived in this dashboard's database. Read by the SAR Systems Hub for the
// "Updated …" line on this dashboard's card. Returns a single timestamp, no data, so it needs no
// sign-in.
import { MongoClient } from 'mongodb';

const uri = process.env.MONGO_URI;
const DB  = 'sar-in-air-ops';
// Same collections and rule as lastSyncAt in api/mongo-batch.js, so the card matches the dashboard.
const DATA_COLLECTIONS = ['air_ops_export', 'air_ops_import', 'air_ops_etdeta'];

let client;
async function getClient() {
  if (!client) {
    client = new MongoClient(uri, { maxPoolSize: 2, serverSelectionTimeoutMS: 8000 });
    await client.connect();
  }
  return client;
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  try {
    const db = (await getClient()).db(DB);
    // Every push wipes and re-inserts the records, so the newest record's creation time (from its
    // ObjectId) is when data was last pushed.
    const newest = await Promise.all(DATA_COLLECTIONS.map((name) =>
      db.collection(name).find({}, { projection: { _id: 1 } }).sort({ _id: -1 }).limit(1).next()));
    const times = newest
      .filter((d) => d && d._id && typeof d._id.getTimestamp === 'function')
      .map((d) => d._id.getTimestamp().getTime());
    return res.status(200).json({ lastUpdated: times.length ? new Date(Math.max(...times)).toISOString() : null });
  } catch (err) {
    console.error('last-updated:', err.message);
    return res.status(500).json({ lastUpdated: null });
  }
}
