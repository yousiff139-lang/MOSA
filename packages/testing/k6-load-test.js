import http from 'k6/http';
import { check, sleep } from 'k6';

// Simulate 100 concurrent users for 3 minutes
export const options = {
    vus: 100,
    duration: '3m',
    thresholds: {
        http_req_duration: ['p(95)<500'], // 95% of requests must complete below 500ms
        http_req_failed: ['rate<0.01'],   // Error rate must be less than 1%
    },
};

export default function () {
    // Phase 1: Authentication Simulation
    const loginPayload = JSON.stringify({
        email: 'test_load@mosa.iq',
        password: 'Password123!',
    });

    const params = {
        headers: {
            'Content-Type': 'application/json',
        },
    };

    // Simulate login
    // const res = http.post('http://localhost:8080/api/auth/login', loginPayload, params);
    // check(res, { 'logged in successfully': (r) => r.status === 200 });

    // Phase 2: Massive Device Toggling
    // For this simulation, we hit the generic telemetry endpoint to measure fastify performance
    const deviceRes = http.get('http://localhost:8080/api/telemetry/history');
    
    check(deviceRes, {
        'telemetry fetched successfully': (r) => r.status === 200,
    });

    sleep(1);
}
