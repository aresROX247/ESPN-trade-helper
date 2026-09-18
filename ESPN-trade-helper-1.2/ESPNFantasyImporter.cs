using System;
using System.Diagnostics;
using System.IO;

public static class ESPNFantasyImporter
{
    public static void Main()
    {
        string projectPath = AppContext.BaseDirectory;
        string npmPath = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ProgramFiles), "nodejs", "npm.cmd");

        if (!File.Exists(npmPath))
        {
            npmPath = "npm.cmd";
        }

        Process process = new Process();
        process.StartInfo.FileName = npmPath;
        process.StartInfo.Arguments = "run browser";
        process.StartInfo.WorkingDirectory = projectPath;
        process.StartInfo.UseShellExecute = false;
        process.StartInfo.CreateNoWindow = false;
        process.Start();
        process.WaitForExit();

        if (process.ExitCode != 0)
        {
            Console.WriteLine("The importer stopped with an error. Press Enter to close.");
            Console.ReadLine();
        }
    }
}