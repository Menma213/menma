
export interface RankTopConfig {
    /**
     * Rank.top API key
     */
    apiKey: string;
    /**
     * API base URL
     * @default https://rank.top/api
     */
    baseURL?: string;
}

export interface AutoposterConfig {
    /**
     * Your Discord.js client instance
     */
    client: any;
    /**
     * The authorization token to use for the autoposter. You can get it from:
     * 
     * https://rank.top/edit/bot/{botId}?page=general&tab=webhooks
     */
    authorization: string;
    /**
     * The interval in seconds to post your bot's stats.
     * @default 30 minutes (minimum 5 minutes)
     */
    interval?: number;
}

export interface PostStatsResponse {
    success: boolean;
    message?: string;
}

export type SlashCommand = {
    id: string;
    name: string;
    description: string;
    options: Array<{
        type: number;
        name: string;
        description: string;
        required?: boolean;
        choices?: Array<{
            name: string;
            value: string;
        }>;
        options?: Array<{
            type: number;
            name: string;
            description: string;
            required?: boolean;
            choices?: Array<{
                name: string;
                value: string;
            }>;
        }>;
    }>;
};

export interface PostedStats {
    serverCount?: number;
    userCount?: number;
    ping?: number;
    memory?: number;
    commands?: SlashCommand[];
}

export type DisableStats = {
    [K in keyof PostedStats]: true;
};
