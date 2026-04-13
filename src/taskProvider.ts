import * as vscode from 'vscode';

type TaskSource = 'Workspace' | 'User' | 'npm';

const SOURCE_LABELS: Record<TaskSource, string> = {
	'Workspace': 'Workspace Tasks',
	'User': 'User Tasks',
	'npm': 'package.json'
};

export class TaskTreeDataProvider implements vscode.TreeDataProvider<TaskTreeItem> {
	private _onDidChangeTreeData: vscode.EventEmitter<TaskTreeItem | null> = new vscode.EventEmitter<TaskTreeItem | null>();
	readonly onDidChangeTreeData: vscode.Event<TaskTreeItem | null> = this._onDidChangeTreeData.event;

	constructor(context: vscode.ExtensionContext) { }

	refresh(): void {
		this._onDidChangeTreeData.fire();
	}

	async getChildren(element?: TaskTreeItem): Promise<TaskTreeItem[]> {
		const grouped = vscode.workspace.getConfiguration('taskRunner').get<boolean>('groupBySource', false);

		if (!element) {
			return grouped ? this.getSourceNodes() : this.getFlatList();
		}
		if (element.contextValue === 'source') {
			return this.getTasksForSource(element.sourceKey!);
		}
		return [];
	}

	private async getFlatList(): Promise<TaskTreeItem[]> {
		const tasks = await vscode.tasks.fetchTasks();
		return tasks.map(task => {
			const item = new TaskTreeItem(
				task.name,
				vscode.TreeItemCollapsibleState.None
			);
			item.contextValue = 'task';
			item.command = {
				command: 'taskrunnervscode.executeTask',
				title: 'Execute',
				arguments: [task]
			};
			return item;
		});
	}

	private async getSourceNodes(): Promise<TaskTreeItem[]> {
		const tasks = await vscode.tasks.fetchTasks();
		const groups = new Map<TaskSource, vscode.Task[]>();

		for (const task of tasks) {
			const source = classifyTask(task);
			if (!source) continue;
			if (!groups.has(source)) groups.set(source, []);
			groups.get(source)!.push(task);
		}

		const order: TaskSource[] = ['Workspace', 'User', 'npm'];
		return order
			.filter(s => groups.has(s))
			.map(s => {
				const item = new TaskTreeItem(
					SOURCE_LABELS[s],
					vscode.TreeItemCollapsibleState.Expanded
				);
				item.contextValue = 'source';
				item.sourceKey = s;
				return item;
			});
	}

	private async getTasksForSource(source: TaskSource): Promise<TaskTreeItem[]> {
		const tasks = await vscode.tasks.fetchTasks();
		return tasks
			.filter(t => classifyTask(t) === source)
			.map(task => {
				const item = new TaskTreeItem(
					task.name,
					vscode.TreeItemCollapsibleState.None
				);
				item.contextValue = 'task';
				item.command = {
					command: 'taskrunnervscode.executeTask',
					title: 'Execute',
					arguments: [task]
				};
				return item;
			});
	}

	getTreeItem(element: TaskTreeItem): vscode.TreeItem {
		return element;
	}
}

function classifyTask(task: vscode.Task): TaskSource | null {
	// npm tasks: distinguish project vs dependency scripts
	if (task.source === 'npm') {
		const taskPath: string | undefined = task.definition?.path;
		return 'npm';
	}

	// task.scope distinguishes where the task is defined:
	//   TaskScope.Global (1) = rarely used global scope
	//   TaskScope.Workspace (2) = User profile tasks (from %APPDATA%/Code/User/tasks.json)
	//   WorkspaceFolder object = tasks from the workspace's .vscode/tasks.json
	if (task.scope === vscode.TaskScope.Global) return 'User';
	if (task.scope === vscode.TaskScope.Workspace) return 'User';
	if (task.scope && typeof task.scope === 'object') return 'Workspace';

	return null;
}

class TaskTreeItem extends vscode.TreeItem {
	sourceKey?: TaskSource;
}

