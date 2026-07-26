'use strict';

const { expect } = require('chai');
const { CONTROL_COMMANDS, buildTrackerCommandPath, parseControlStateId } = require('../../build/lib/commands');

describe('tracker commands', () => {
    it('maps control keys to API command names', () => {
        expect(CONTROL_COMMANDS.liveTrackingActive).to.equal('live_tracking');
        expect(CONTROL_COMMANDS.ledActive).to.equal('led_control');
        expect(CONTROL_COMMANDS.buzzerActive).to.equal('buzzer_control');
    });

    it('builds command paths', () => {
        expect(buildTrackerCommandPath('ABC', 'led_control', true)).to.equal('/tracker/ABC/command/led_control/on');
        expect(buildTrackerCommandPath('ABC', 'buzzer_control', false)).to.equal(
            '/tracker/ABC/command/buzzer_control/off',
        );
    });

    it('parses writable control state ids', () => {
        expect(parseControlStateId('tractive-next.0.XLYLJQDD.controls.ledActive')).to.deep.equal({
            trackerId: 'XLYLJQDD',
            controlKey: 'ledActive',
        });
        expect(parseControlStateId('tractive-next.0.XLYLJQDD.controls.trackerState')).to.equal(null);
        expect(parseControlStateId('tractive-next.0.info.connection')).to.equal(null);
    });
});
