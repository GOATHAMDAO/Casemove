Option Explicit

Dim shell, fileSystem, launcherPath, projectFolder, command
Set shell = CreateObject("WScript.Shell")
Set fileSystem = CreateObject("Scripting.FileSystemObject")

projectFolder = fileSystem.GetParentFolderName(WScript.ScriptFullName)
launcherPath = projectFolder & "\Start-Casemove-Dev.bat"

' Explicitly invoke cmd.exe and quote the batch file.  This prevents Windows
' from accidentally starting Electron itself (without the Casemove folder).
shell.CurrentDirectory = projectFolder
command = "cmd.exe /d /s /c " & Chr(34) & Chr(34) & launcherPath & Chr(34) & Chr(34)
shell.Run command, 0, False
