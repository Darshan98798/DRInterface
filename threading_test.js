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
            name: 'API Test User',
            rating: 5,
            comment: 'This is a test comment for threading.'
        });
        console.log("Review Status:", reviewRes.status, reviewRes.body);

        console.log("\n2. Fetching all reviews to get the ID...");
        const allRes = await request('/api/reviews', 'GET', {});
        console.log("All Reviews Response:", allRes.status, allRes.body);
        if (!Array.isArray(allRes.body) || allRes.body.length === 0) {
            throw new Error("No reviews found in the response.");
        }
        const latestReview = allRes.body[0];
        const reviewId = latestReview.id;
        console.log("Latest Review ID:", reviewId);

        console.log("\n3. Simulating Admin Reply (Status -> Approved + Thread)...");
        const adminReplyRes = await request(`/api/reviews/${reviewId}`, 'PUT', {
            status: 'approved',
            thread: [{ role: 'admin', text: 'Thank you for your feedback!', timestamp: new Date().toISOString() }]
        });
        console.log("Admin Reply Status:", adminReplyRes.status);

        console.log("\n4. Testing NEW User Reply endpoint...");
        const userReplyRes = await request('/api/submit-user-reply', 'POST', {
            reviewId: reviewId,
            text: 'I am replying back to the admin!'
        });
        console.log("User Reply Status:", userReplyRes.status, userReplyRes.body);

        console.log("\n5. Verifying final thread state...");
        const finalRes = await request('/api/reviews', 'GET', {});
        const finalReview = finalRes.body.find(r => r.id === reviewId);
        console.log("Final Thread:", JSON.stringify(finalReview.thread, null, 2));

    } catch (e) {
        console.error("Test failed:", e);
    }
}

runTest();
