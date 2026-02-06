import chalk from 'chalk';
import Table from 'cli-table3';

export class Dashboard {
    static printBanner(appCount: number) {
        console.clear();
        console.log(chalk.bold.cyan('┌────────────────────────────────────────────────────────────┐'));
        console.log(chalk.bold.cyan('│  🤖 AgentSocial Multi-Platform Bridge                      │'));
        console.log(chalk.bold.cyan('└────────────────────────────────────────────────────────────┘'));
        console.log(chalk.gray(`   Loaded ${chalk.yellow(appCount)} app(s) from config.json\n`));
    }

    static printTable(apps: any[]) {
        const table = new Table({
            head: [chalk.white('Platform'), chalk.white('App ID'), chalk.white('Agent'), chalk.white('Status')],
            colWidths: [15, 30, 15, 15],
            style: { head: [], border: [] } 
        });

        apps.forEach(app => {
            const platformName = app.platform 
                ? (app.platform === 'feishu' ? chalk.blue('Feishu') : app.platform)
                : chalk.gray('unknown');

            table.push([
                platformName,
                chalk.gray(app.app_id.substring(0, 20) + '...'),
                chalk.magenta(app.agent_type || 'gemini'),
                chalk.green('● Online')
            ]);
        });

        console.log(table.toString());
        console.log('\n');
    }

    static logEvent(type: string, msg: string) {
        const time = new Date().toLocaleTimeString();
        let prefix = '';
        
        switch(type) {
            case 'MSG': prefix = chalk.blue('[MSG]'); break;
            case 'CMD': prefix = chalk.yellow('[CMD]'); break;
            case 'EXE': prefix = chalk.cyan('[EXE]'); break;
            case 'ERR': prefix = chalk.red('[ERR]'); break;
            case 'SYS': prefix = chalk.gray('[SYS]'); break;
            default: prefix = chalk.white(`[${type}]`);
        }

        console.log(`${chalk.gray(time)} ${prefix} ${msg}`);
    }
}