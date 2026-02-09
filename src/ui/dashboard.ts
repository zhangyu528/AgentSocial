import chalk from 'chalk';
import Table from 'cli-table3';
import * as path from 'path';

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
            head: [chalk.white('Platform'), chalk.white('App ID'), chalk.white('Agent'), chalk.white('Project'), chalk.white('Status')],
            colWidths: [12, 20, 12, 20, 15],
            style: { head: [], border: [] } 
        });

        apps.forEach(app => {
            const platformName = app.platform 
                ? (app.platform === 'feishu' ? chalk.blue('Feishu') : app.platform)
                : chalk.gray('unknown');

            const projectName = path.basename(app.project_path || process.cwd());

            let statusStr = chalk.yellow('○ Starting');
            if (app.status === 'online') statusStr = chalk.green('● Online');
            else if (app.status === 'error') statusStr = chalk.red('✖ Error');
            else if (app.status === 'offline') statusStr = chalk.gray('○ Offline');

            table.push([
                platformName,
                chalk.gray(app.app_id.substring(0, 12) + '...'),
                chalk.magenta(app.agent_type || 'gemini cli'),
                chalk.cyan(projectName),
                statusStr
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