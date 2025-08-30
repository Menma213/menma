import axios, { AxiosInstance } from 'axios';
import { EventEmitter } from 'events';
import { RankTopConfig, AutoposterConfig, PostStatsResponse, PostedStats, DisableStats } from './types';

export declare interface RankTopClient {
    on(event: 'autoposter/posted', listener: (stats: PostedStats) => void): this;
    on(event: 'autoposter/error', listener: (error: unknown) => void): this;
    on(event: 'autoposter/stopped', listener: () => void): this;

    emit(event: 'autoposter/posted', stats: PostedStats): boolean;
    emit(event: 'autoposter/error', error: unknown): boolean;
    emit(event: 'autoposter/stopped'): boolean;
}

export class RankTopClient extends EventEmitter {
    private readonly api: AxiosInstance;
    private autopostHandler?: NodeJS.Timeout;

    constructor(config: RankTopConfig) {
        super();
        this.api = axios.create({
            baseURL: config.baseURL || 'https://rank.top/api',
            headers: {
                'Authorization': `Bearer ${config.apiKey}`,
                'Content-Type': 'application/json'
            },
        });
    };

    private async postStats(stats: PostedStats, botId: string, authorization: string): Promise<PostStatsResponse> {
        const response = await this.api.post(`/bots/${botId}/post`, { ...stats, authorization });
        return response.data;
    };

    async startAutopost(config: AutoposterConfig, disableStats: DisableStats | undefined = {}): Promise<void> {
        const client = config?.client;
        if (!client) {
            return console.error('[Rank.top Autoposter] Client is not defined');
        };

        // Stop any existing autoposter
        if (this.autopostHandler) {
            this.stopAutopost();
        };

        const postStats = async (): Promise<void> => {
            // Prepare stats
            const stats: PostedStats = {
                serverCount: disableStats.serverCount ? undefined
                    : client.guilds?.cache?.size || undefined,
                userCount: disableStats.userCount ? undefined
                    : client.users?.cache?.size || undefined,
                ping: disableStats.ping ? undefined
                    : client.ws?.ping || undefined,
                memory: disableStats.memory ? undefined
                    : (Math.round(process.memoryUsage().heapUsed / 1024 / 1024)) || undefined,
            };

            // Fetch Slash Commands
            if (!disableStats.commands) {
                const commands = await client.application?.commands?.fetch?.();
                if (commands?.map) {
                    stats.commands = commands.map((command: any) => ({
                        id: command.id,
                        name: command.name,
                        description: command.description,
                        options: command.options.map((option: any) => ({
                            type: option.type,
                            name: option.name,
                            description: option.description,
                            required: option.required,
                            choices: option.choices?.map((choice: any) => ({
                                name: choice.name,
                                value: choice.value
                            })),
                            options: option.options?.map((subOption: any) => ({
                                type: subOption.type,
                                name: subOption.name,
                                description: subOption.description,
                                required: subOption.required,
                                choices: subOption.choices?.map((choice: any) => ({
                                    name: choice.name,
                                    value: choice.value
                                }))
                            }))
                        }))
                    }));
                };
            };

            try {
                const response = await this.postStats(stats, client.user.id, config.authorization);
                if (response?.success) {
                    this.emit('autoposter/posted', stats);
                } else {
                    this.emit('autoposter/error', response?.message || 'Unknown error');
                };
            } catch (error) {
                this.emit('autoposter/error', error);
            };
        };

        // Wait 1 minute
        await new Promise(resolve => setTimeout(resolve, 60 * 1000));

        let started = false;
        const post = async (): Promise<void> => {
            started = true;

            // Post stats immediately
            await postStats();

            // Set up interval for future posts
            const interval = Math.max(5 * 60, (config.interval || 30 * 60)) * 1000;
            this.autopostHandler = setInterval(postStats, interval);
        };

        client.on('ready', post);

        if (client.isReady() && !started) {
            setTimeout(() => {
                if (!started) post();
            }, 5000);
        };
    };

    stopAutopost(): void {
        if (this.autopostHandler) {
            clearInterval(this.autopostHandler);
            this.autopostHandler = undefined;
            this.emit('autoposter/stopped');
        };
    };
};
