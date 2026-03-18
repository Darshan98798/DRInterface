const express = require('express');
const multer = require('multer');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

require('dotenv').config();

// Initialize Supabase Client (Service Role for server-side privileged access)
const SUPABASE_URL = 'https://nqtqboeddlopocqnsblz.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || 'sb_publishable_NK9Yw0mUpVTo5btwnp8d7A_2ZI4efVV';
const supabaseClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// Admin Credentials (Move to .env for production!)
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'drinterface2024';


const app = express();
const PORT = process.env.PORT || 3000;

// Allow requests from the main Godaddy domain, Render URL itself, and localhost for dev
const allowedOrigins = [
    'http://localhost:3000',
    'http://localhost:5500', 
    'http://127.0.0.1:5500',
    'https://drinterface.com',
    'https://www.drinterface.com'
];

app.use(cors({
    origin: '*', // Relaxed for development stability
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept']
}));
app.use(express.json());

// Load valid users from firebase-config.js (Mock approach for local validation if needed)

const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

// Move logger to TOP
app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
    next();
});



// ──────────────────────────────────────────────────────────────────
// API: Admin Login (Secure)
// ──────────────────────────────────────────────────────────────────
app.post('/api/admin/login', (req, res) => {
    const { password } = req.body;
    if (password === ADMIN_PASSWORD) {
        res.json({ success: true, token: 'session_' + Date.now() }); // Simple mock token
    } else {
        res.status(401).json({ success: false, error: 'Incorrect password' });
    }
});


// ──────────────────────────────────────────────────────────────────
// API: Upload Image to Supabase Storage
// ──────────────────────────────────────────────────────────────────
app.post('/api/upload', upload.single('image'), async (req, res) => {
    console.log(`[DEBUG /api/upload] Route hit! File present: ${!!req.file}`);
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No image file provided' });
        }

        const fileExt = req.file.originalname.split('.').pop();
        const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;

        const { data, error } = await supabaseClient
            .storage
            .from('project-images') // User's known bucket name
            .upload(fileName, req.file.buffer, {
                contentType: req.file.mimetype,
                upsert: false
            });

        if (error) throw error;

        // Get public URL
        const { data: publicUrlData } = supabaseClient
            .storage
            .from('project-images')
            .getPublicUrl(fileName);

        res.json({ success: true, url: publicUrlData.publicUrl });
    } catch (e) {
        console.error('[POST /api/upload] Error:', e);
        res.status(500).json({ error: e.message });
    }
});

// ──────────────────────────────────────────────────────────────────
// API: CMS Get All Projects 
// ──────────────────────────────────────────────────────────────────
app.get('/api/projects', async (req, res) => {
    try {
        const { data, error } = await supabaseClient
            .from('projects')
            .select('*')
            .order('created_at', { ascending: false });
        
        if (error) throw error;
        res.json(data || []);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.get('/api/version', (req, res) => {
    res.json({ version: '2.0.1', status: 'Healthy', timestamp: new Date().toISOString() });
});

// ──────────────────────────────────────────────────────────────────
// API: Create/Update Project
// ──────────────────────────────────────────────────────────────────
app.post('/api/project', async (req, res) => {
    try {
        const projectData = req.body;
        if (!projectData || !projectData.id) {
            return res.status(400).json({ error: 'Missing project data or ID' });
        }

        const { data, error } = await supabaseClient
            .from('projects')
            .upsert(projectData)
            .select();

        if (error) throw error;
        res.json({ success: true, project: data[0] });
    } catch (e) {
        console.error('[POST /api/project] Error:', e);
        res.status(500).json({ error: e.message });
    }
});

// ──────────────────────────────────────────────────────────────────
// API: CMS Delete Project
// ──────────────────────────────────────────────────────────────────
app.delete('/api/project/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { error } = await supabaseClient
            .from('projects')
            .delete()
            .eq('id', id);

        if (error) throw error;
        res.json({ success: true, message: 'Project deleted' });
    } catch (e) {
        console.error('[DELETE /api/project] Error:', e);
        res.status(500).json({ error: e.message });
    }
});






// ──────────────────────────────────────────────────────────────────
// API: Public Review Submission (bypasses RLS via service key)
// ──────────────────────────────────────────────────────────────────
app.post('/api/submit-review', async (req, res) => {
    try {
        const { project_id, name, rating, comment } = req.body;

        if (!project_id || !name || !rating || !comment) {
            return res.status(400).json({ error: 'Missing required fields: project_id, name, rating, comment' });
        }
        if (typeof rating !== 'number' || rating < 1 || rating > 5) {
            return res.status(400).json({ error: 'Rating must be a number between 1 and 5' });
        }

        const { error } = await supabaseClient
            .from('project_reviews')
            .insert({
                project_id,
                name,
                rating,
                comment,
                status: 'pending',
                thread: []
            });

        if (error) throw error;

        res.json({ success: true, message: 'Review submitted successfully and is pending approval.' });
    } catch (e) {
        console.error('[submit-review] Error:', e);
        res.status(500).json({ error: e.message });
    }
});

// ──────────────────────────────────────────────────────────────────
// API: Submit User Reply to existing review thread (Service Key)
// ──────────────────────────────────────────────────────────────────
app.post('/api/submit-user-reply', async (req, res) => {
    try {
        const { reviewId, text } = req.body;
        if (!reviewId || !text) {
            return res.status(400).json({ error: 'Missing reviewId or text' });
        }

        // 1. Fetch current thread
        const { data: review, error: fetchErr } = await supabaseClient
            .from('project_reviews')
            .select('thread, name')
            .eq('id', reviewId)
            .single();

        if (fetchErr) throw fetchErr;

        // 2. Append user reply
        const updatedThread = [...(review.thread || []), {
            role: 'user',
            text: text,
            timestamp: new Date().toISOString()
        }];

        // 3. Update thread
        const { error: updateErr } = await supabaseClient
            .from('project_reviews')
            .update({ thread: updatedThread })
            .eq('id', reviewId);

        if (updateErr) throw updateErr;

        console.log(`--> [THREAD] User reply added to review ${reviewId}`);
        res.json({ success: true });
    } catch (e) {
        console.error('[submit-user-reply] Error:', e);
        res.status(500).json({ error: e.message });
    }
});

// ──────────────────────────────────────────────────────────────────
// API: Admin Reply to existing review thread (Service Key)
// ──────────────────────────────────────────────────────────────────
app.post('/api/admin-reply', async (req, res) => {
    try {
        const { id, text } = req.body;
        if (!id || !text) {
            return res.status(400).json({ error: 'Missing review id or text' });
        }

        // 1. Fetch current thread
        const { data: review, error: fetchErr } = await supabaseClient
            .from('project_reviews')
            .select('thread')
            .eq('id', id)
            .single();

        if (fetchErr) throw fetchErr;

        // 2. Append admin reply
        const updatedThread = [...(review.thread || []), {
            role: 'admin',
            text: text,
            timestamp: new Date().toISOString()
        }];

        // 3. Update thread
        const { error: updateErr } = await supabaseClient
            .from('project_reviews')
            .update({ thread: updatedThread })
            .eq('id', id);

        if (updateErr) throw updateErr;

        console.log(`--> [THREAD] Admin reply added to review ${id}`);
        res.json({ success: true });
    } catch (e) {
        console.error('[admin-reply] Error:', e);
        res.status(500).json({ error: e.message });
    }
});

// ──────────────────────────────────────────────────────────────────
// API: Public Fetch Approved Reviews (bypasses RLS via service key)
// ──────────────────────────────────────────────────────────────────
app.get('/api/approved-reviews/:project_id', async (req, res) => {
    const { project_id } = req.params;
    const { data, error } = await supabaseClient
        .from('project_reviews')
        .select('*')
        .eq('project_id', project_id)
        .eq('status', 'approved')
        .order('created_at', { ascending: false });
    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
});

// ──────────────────────────────────────────────────────────────────
// API: Reviews (Admin Proxy to bypass RLS)
// ──────────────────────────────────────────────────────────────────
app.get('/api/reviews', async (req, res) => {
    const { data, error } = await supabaseClient
        .from('project_reviews')
        .select('*')
        .order('created_at', { ascending: false });
    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
});

app.put('/api/reviews/:id', async (req, res) => {
    const { id } = req.params;
    const { status, thread } = req.body;
    
    let updateData = {};
    if (status) updateData.status = status;
    if (thread) updateData.thread = thread;

    const { error } = await supabaseClient
        .from('project_reviews')
        .update(updateData)
        .eq('id', id);
    if (error) return res.status(500).json({ error: error.message });
    res.json({ success: true });
});

app.delete('/api/reviews/:id', async (req, res) => {
    const { id } = req.params;
    const { error } = await supabaseClient
        .from('project_reviews')
        .delete()
        .eq('id', id);
    if (error) return res.status(500).json({ error: error.message });
    res.json({ success: true });
});

// ──────────────────────────────────────────────────────────────────
// API: Access Requests (Admin Proxy to bypass RLS)
// ──────────────────────────────────────────────────────────────────
app.get('/api/access_requests', async (req, res) => {
    const { data, error } = await supabaseClient
        .from('access_requests')
        .select('*')
        .order('created_at', { ascending: false });
    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
});

app.delete('/api/access_requests/:id', async (req, res) => {
    const { id } = req.params;
    const { error } = await supabaseClient
        .from('access_requests')
        .delete()
        .eq('id', id);
    if (error) return res.status(500).json({ error: error.message });
    res.json({ success: true });
});



// ──────────────────────────────────────────────────────────────────
// API: Site Feedback (Portfolio-wide Reviews)
// ──────────────────────────────────────────────────────────────────
app.post('/api/submit-feedback', async (req, res) => {
    try {
        const { name, role, rating, comment } = req.body;
        console.log(`--> [FEEDBACK] Received submission from: ${name}`);

        if (!name || !comment) {
            return res.status(400).json({ error: 'Name and comment are required.' });
        }
        
        const initials = name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
        
        const feedbackData = {
            name,
            role: role || 'Visitor',
            rating: rating || 5,
            comment,
            avatar_initials: initials,
            status: 'pending'
        };

        const { error } = await supabaseClient.from('site_feedback').insert(feedbackData);
        
        if (error) {
            console.error('--> [FEEDBACK] Supabase Error:', error);
            return res.status(500).json({ error: `Supabase Error: ${error.message} (Code: ${error.code})` });
        }

        res.json({ success: true, message: 'Thank you! Your feedback has been submitted and is awaiting approval.' });
    } catch (e) {
        console.error('--> [FEEDBACK] System Error:', e);
        res.status(500).json({ error: `Internal Server Error: ${e.message}` });
    }
});

app.get('/api/site-feedback', async (req, res) => {
    const { data, error } = await supabaseClient
        .from('site_feedback')
        .select('*')
        .eq('status', 'approved')
        .order('created_at', { ascending: false });
    if (error) return res.status(500).json({ error: error.message });
    res.json(data || []);
});

app.get('/api/admin-feedback', async (req, res) => {
    const { data, error } = await supabaseClient
        .from('site_feedback')
        .select('*')
        .order('created_at', { ascending: false });
    if (error) return res.status(500).json({ error: error.message });
    res.json(data || []);
});

app.put('/api/feedback/:id', async (req, res) => {
    const { id } = req.params;
    const { status } = req.body;
    const { error } = await supabaseClient.from('site_feedback').update({ status }).eq('id', id);
    if (error) return res.status(500).json({ error: error.message });
    res.json({ success: true });
});

app.delete('/api/feedback/:id', async (req, res) => {
    const { id } = req.params;
    const { error } = await supabaseClient.from('site_feedback').delete().eq('id', id);
    if (error) return res.status(500).json({ error: error.message });
    res.json({ success: true });
});

// Removed logger from here (moved to top)

// Add global error handler to catch unseen upload/multer errors
app.use((err, req, res, next) => {
    console.error("--> [EXPRESS ERROR HANDLER] Caught error:", err);
    res.status(500).json({ error: "Internal Server Error", details: err.message });
});

app.listen(PORT, async () => {
    console.log(`🚀 Admin API Server is running on port ${PORT}!`);
});
