using System;
using System.Diagnostics;
using System.IO;

public static class ESPNFantasyImporter
{
    private static string FindNode()
    {
        string programFiles = Environment.GetEnvironmentVariable("ProgramFiles");
        if (!string.IsNullOrEmpty(programFiles))
        {
            string candidate = Path.Combine(programFiles, "nodejs", "node.exe");
            if (File.Exists(candidate))
            {
                return candidate;
            }
        }

        return "node.exe";
    }

    private static string FindNpm()
    {
        string programFiles = Environment.GetEnvironmentVariable("ProgramFiles");
        if (!string.IsNullOrEmpty(programFiles))
        {
            string candidate = Path.Combine(programFiles, "nodejs", "npm.cmd");
            if (File.Exists(candidate))
            {
                return candidate;
            }
        }

        return "npm.cmd";
    }

    private static string ResolveProjectPath()
    {
        string basePath = AppContext.BaseDirectory;
        if (File.Exists(Path.Combine(basePath, "package.json")))
        {
            return basePath;
        }

        string currentDirectory = Directory.GetCurrentDirectory();
        if (File.Exists(Path.Combine(currentDirectory, "package.json")))
        {
            return currentDirectory;
        }

        return basePath;
    }

    private static bool NodeIsAvailable(out string nodePath)
    {
        nodePath = FindNode();
        try
        {
            Process process = new Process();
            process.StartInfo.FileName = nodePath;
            process.StartInfo.Arguments = "--version";
            process.StartInfo.UseShellExecute = false;
            process.StartInfo.RedirectStandardOutput = true;
            process.StartInfo.CreateNoWindow = true;
            process.Start();
            process.WaitForExit();
            return process.ExitCode == 0;
        }
        catch
        {
            return false;
        }
    }

    private static int Run(string fileName, string arguments, string workingDirectory)
    {
        Process process = new Process();
        process.StartInfo.FileName = fileName;
        process.StartInfo.Arguments = arguments;
        process.StartInfo.WorkingDirectory = workingDirectory;
        process.StartInfo.UseShellExecute = false;
        process.StartInfo.CreateNoWindow = false;
        process.Start();
        process.WaitForExit();
        return process.ExitCode;
    }

    private static void Pause(string message)
    {
        Console.WriteLine(message);
        Console.WriteLine("Press Enter to close.");
        Console.ReadLine();
    }

    public static void Main(string[] args)
    {
        string projectPath = ResolveProjectPath();

        Console.WriteLine("ESPN Fantasy League Viewer launcher");
        Console.WriteLine();

        string nodePath;
        if (!NodeIsAvailable(out nodePath))
        {
            Console.WriteLine("Node.js was not found on this computer.");
            Console.WriteLine("Install the LTS version from https://nodejs.org/en/download, then run this launcher again.");
            Console.WriteLine();
            try
            {
                Process.Start("https://nodejs.org/en/download");
            }
            catch
            {
                Console.WriteLine("Open https://nodejs.org/en/download manually.");
            }

            Pause("Opening the Node.js download page...");
            return;
        }

        string npmPath = FindNpm();
        string nodeModules = Path.Combine(projectPath, "node_modules");
        if (!Directory.Exists(nodeModules))
        {
            Console.WriteLine("Installing dependencies for the first run. This can take a minute...");
            Console.WriteLine();
            if (Run(npmPath, "install --no-audit --no-fund --loglevel=error", projectPath) != 0)
            {
                Pause("Dependency installation failed. Scroll up for the npm error.");
                return;
            }

            Console.WriteLine();
        }

        string command = "run browser";
        if (args.Length > 0 && args[0].Equals("serve", StringComparison.OrdinalIgnoreCase))
        {
            command = "run start";
        }
        else if (args.Length > 0 && args[0].Equals("setup", StringComparison.OrdinalIgnoreCase))
        {
            command = "run setup";
        }

        Console.WriteLine("Starting: npm " + command);
        Console.WriteLine();

        int exitCode = Run(npmPath, command, projectPath);
        if (exitCode != 0)
        {
            Pause("The importer stopped with an error. Read the message above, then try again.");
        }
    }
}