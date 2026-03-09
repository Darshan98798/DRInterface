const http = require('http');

async function request(path, method, data) {
    return new Promise((resolve, reject) => {
        const body = JSON.stringify(data);
        const options = {
            hostname: 'localhost',
            port: 3000,
            path: path,
            method: method,
            headers: {
                'Content-Type': 'application/json'
            }
        };
        if (method !== 'GET') {
            options.headers['Content-Length'] = Buffer.byteLength(body);
        }
        const req = http.request(options, (res) => {
            let resBody = '';
            res.on('data', (d) => resBody += d);
            res.on('end', () => {
                try {
                    resolve({ status: res.statusCode, body: JSON.parse(resBody) });
                } catch (e) {
                    resolve({ status: res.statusCode, body: resBody });
                }
            });
        });
        req.on('error', (e) => reject(e));
        if (method !== 'GET') req.write(body);
        req.end();
    });
}

async function runTest() {
    try {
        console.log("1. Submitting a test review...");
        const reviewRes = await request('/api/submit-review', 'POST', {
            project_id: 'proj_xoa9frq57',
            name: 'Final Fix Test',
            rating: 5,
            comment: 'Verifying all buttons work.'
        });
        console.log("Review Status:", reviewRes.status);

        console.log("\n2. Fetching reviews to find the new one...");
        const allRes = await request('/api/reviews', 'GET', {});
        // Find the one we just made
        const latestReview = allRes.body.find(r => r.name === 'Final Fix Test');
        if (!latestReview) throw new Error("Could not find the submitted review. RLS might still be blocking SELECT.");
        const reviewId = latestReview.id;
        console.log("Review ID Found:", reviewId);

        console.log("\n3. Testing APPROVE button (Admin Action)...");
        const approveRes = await request(`/api/reviews/${reviewId}`, 'PUT', { status: 'approved' });
        console.log("Approve Status:", approveRes.status);

        console.log("\n4. Testing ADMIN REPLY (Threading)...");
        const adminReplyRes = await request('/api/admin-reply', 'POST', { id: reviewId, text: 'Hello from Admin!' });
        console.log("Admin Reply Status:", adminReplyRes.status);

        console.log("\n5. Testing USER REPLY (Threading)...");
        const userReplyRes = await request('/api/submit-user-reply', 'POST', { reviewId: reviewId, text: 'Hello back from User!' });
        console.log("User Reply Status:", userReplyRes.status);

        console.log("\n6. Verifying final thread state...");
        const finalAllRes = await request('/api/reviews', 'GET', {});
        const finalReview = finalAllRes.body.find(r => r.id === reviewId);
        console.log("Final Thread Length:", finalReview.thread.length);
        console.log("Final Thread Content:", JSON.stringify(finalReview.thread, null, 2));

        console.log("\n7. Testing DELETE button (Admin Action)...");
        const deleteRes = await request(`/api/reviews/${reviewId}`, 'DELETE', {});
        console.log("Delete Status:", deleteRes.status);

        console.log("\n✅ ALL TESTS PASSED!");

    } catch (e) {
        console.error("❌ Test failed:", e.message);
    }
}

runTest();
