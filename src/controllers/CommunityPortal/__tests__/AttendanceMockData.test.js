const { participants, events, attendance } = require('../AttendanceMockData');

describe('AttendanceMockData', () => {
  describe('module exports', () => {
    it('exports participants, events, and attendance arrays', () => {
      expect(Array.isArray(participants)).toBe(true);
      expect(Array.isArray(events)).toBe(true);
      expect(Array.isArray(attendance)).toBe(true);
    });

    it('exports non-empty arrays', () => {
      expect(participants.length).toBeGreaterThan(0);
      expect(events.length).toBeGreaterThan(0);
      expect(attendance.length).toBeGreaterThan(0);
    });
  });

  describe('participants', () => {
    it('has the expected shape and required fields for every entry', () => {
      participants.forEach((participant) => {
        expect(participant).toEqual(
          expect.objectContaining({
            participantID: expect.any(Number),
            name: expect.any(String),
            age: expect.any(Number),
            gender: expect.any(String),
            location: expect.any(String),
          }),
        );
      });
    });

    it('has unique participantID values', () => {
      const ids = participants.map((p) => p.participantID);
      expect(new Set(ids).size).toBe(ids.length);
    });
  });

  describe('events', () => {
    it('has the expected shape and required fields for every entry', () => {
      events.forEach((event) => {
        expect(event).toEqual(
          expect.objectContaining({
            eventID: expect.any(Number),
            eventType: expect.any(String),
            eventName: expect.any(String),
            date: expect.any(String),
            location: expect.any(String),
          }),
        );
      });
    });

    it('has unique eventID values', () => {
      const ids = events.map((e) => e.eventID);
      expect(new Set(ids).size).toBe(ids.length);
    });

    it('only uses known event types', () => {
      const knownTypes = ['WorkShop', 'Conference', 'Webinar'];
      events.forEach((event) => {
        expect(knownTypes).toContain(event.eventType);
      });
    });
  });

  describe('attendance', () => {
    it('has the expected shape and required fields for every entry', () => {
      attendance.forEach((record) => {
        expect(record).toEqual(
          expect.objectContaining({
            attendanceID: expect.any(Number),
            eventID: expect.any(Number),
            participantID: expect.any(Number),
            checkInTime: expect.any(String),
            attended: expect.any(Boolean),
          }),
        );
      });
    });

    it('references only participantIDs that exist in participants', () => {
      const validParticipantIds = new Set(participants.map((p) => p.participantID));
      attendance.forEach((record) => {
        expect(validParticipantIds.has(record.participantID)).toBe(true);
      });
    });

    it('references only eventIDs that exist in events', () => {
      const validEventIds = new Set(events.map((e) => e.eventID));
      attendance.forEach((record) => {
        expect(validEventIds.has(record.eventID)).toBe(true);
      });
    });
  });
});
