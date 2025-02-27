import { SettingModel } from 'hydrooj'

/** @param {import('hydrooj').Context} ctx */
export function apply(ctx) {
    ctx.inject(['setting'], (c) => {
        c.setting.SystemSetting(
            SettingModel.Setting('external_scoreboard', 'external_scoreboard.enable', false, 'boolean', 'Enable external scoreboard'),
            SettingModel.Setting('external_scoreboard', 'external_scoreboard.contest', null, 'text', 'Contest ID for external scoreboard'),
        )
    })
    ctx.plugin(require('./ScoreboardHandler'))
}
