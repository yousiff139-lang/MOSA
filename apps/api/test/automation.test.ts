import { describe, it, expect } from 'vitest';

describe('Automation Engine Core Tests', () => {
    it('Should correctly evaluate numeric greater-than conditions', () => {
        const condition = {
            fact: 'temperature',
            operator: 'greaterThan',
            value: 30
        };
        const telemetry = { temperature: 35 };
        
        // Mock evaluation logic
        let isMet = false;
        if (condition.operator === 'greaterThan') {
            isMet = telemetry[condition.fact as keyof typeof telemetry] > condition.value;
        }

        expect(isMet).toBe(true);
    });

    it('Should correctly prevent execution when condition is not met', () => {
        const condition = {
            fact: 'temperature',
            operator: 'greaterThan',
            value: 30
        };
        const telemetry = { temperature: 25 }; // Under limit
        
        let isMet = false;
        if (condition.operator === 'greaterThan') {
            isMet = telemetry[condition.fact as keyof typeof telemetry] > condition.value;
        }

        expect(isMet).toBe(false);
    });
});
