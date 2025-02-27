import { ContestModel, ContestNotLiveError, Handler, NotFoundError, ObjectId, SystemModel, UserModel } from 'hydrooj';

export class ExternalScoreboard extends Handler {
    noCheckPermView = true;

    tsdocAsPublic() {
        if (!this.tsdoc) return null;
        return pick(this.tsdoc, ['attend', 'subscribe', 'startAt', ...(this.tdoc.duration ? ['endAt'] : [])]);
    }

    async get({ domainId }) {
        if (!SystemModel.get('external_scoreboard.enable')) {
            throw new NotFoundError('External scoreboard is not enabled');
        }
        const tid = new ObjectId(SystemModel.get('external_scoreboard.contest'));
        this.tdoc = await ContestModel.get(domainId, tid);
        if (ContestModel.isNotStarted(this.tdoc)) throw new ContestNotLiveError(domainId, tid);
        const view = this.ctx.scoreboard.getView('public');
        const args = {};
        const fetcher = {
            tdoc: () => this.tdoc,
            groups: async () => {
                return await UserModel.listGroup(domainId, undefined);
            },
        };
        for (const key in view.args) {
            if (typeof view.args[key] === 'function') {
                try {
                    args[key] = view.args[key](this.args[key]);
                } catch (e) {
                    throw new ValidationError(key);
                }
            } else if (view.args[key] instanceof Array) {
                if (this.args[key] === undefined && view.args[key].find((i) => i === true)) continue;
                if (view.args[key][1] && !view.args[key][1](this.args[key])) throw new ValidationError(key);
                args[key] = view.args[key][0](this.args[key]);
            } else if (fetcher[view.args[key]]) {
                args[key] = await fetcher[view.args[key]](); // eslint-disable-line no-await-in-loop
            }
        }
        await view.display.call(this, args);
    }
}

/** @param {import('hydrooj').Context} ctx */
export function apply(ctx) {
    ctx.Route('external_scoreboard', '/scoreboard', ExternalScoreboard)
    ctx.inject(['scoreboard'], ({ scoreboard }) => {
        scoreboard.addView('public', 'Public', { tdoc: 'tdoc', groups: 'groups' }, {
            async display({ tdoc, groups }) {
                const config = { isExport: false, showDisplayName: true };
                if (this.tdoc.lockAt && !this.tdoc.unlocked) {
                    config.lockAt = this.tdoc.lockAt;
                }
                const [, rows, udict, pdict] = await ContestModel.getScoreboard.call(this, tdoc.domainId, tdoc._id, config);
                // eslint-disable-next-line @typescript-eslint/naming-convention
                const page_name = tdoc.rule === 'homework'
                    ? 'homework_scoreboard'
                    : 'contest_scoreboard';
                const availableViews = scoreboard.getAvailableViews(tdoc.rule);
                this.response.body = {
                    tdoc: this.tdoc, tsdoc: this.tsdocAsPublic(), rows, udict, pdict, page_name, groups, availableViews,
                };
                this.response.pjax = 'partials/scoreboard.html';
                this.response.template = 'public_scoreboard.html';
            },
            supportedRules: ['*'],
        });
    })
}
