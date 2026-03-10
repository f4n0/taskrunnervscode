'use strict';

import * as vscode from 'vscode';
import { TaskTreeDataProvider } from './taskProvider'

export function activate(context: vscode.ExtensionContext) {

	const taskTreeDataProvider = new TaskTreeDataProvider(context);

	vscode.window.registerTreeDataProvider('taskrunnervscode', taskTreeDataProvider);
	vscode.commands.registerCommand('taskrunnervscode.refresh', () => taskTreeDataProvider.refresh());

	vscode.commands.registerCommand('taskrunnervscode.executeTask', function (task) {
		vscode.tasks.executeTask(task).then(function (value) {
			return value;
		}, function (e) {
			console.error('Error executing task: ' + e);
		});
	});
}

export function deactivate(): void {

}