package <%= LanguageName %>.lang

import com.intellij.openapi.project.Project
import com.redhat.devtools.lsp4ij.server.ProcessStreamConnectionProvider
import com.intellij.openapi.application.PluginPathManager
import com.intellij.util.EnvironmentUtil
import java.io.File
import java.nio.file.Paths
import kotlin.io.path.pathString

class <%= LanguageName %>LanguageServer(project: Project) : ProcessStreamConnectionProvider() {
    // Inspired by Haskell's IntelliJ plugin
    private fun findExecutableInPATH(executable: String) =
        EnvironmentUtil.getEnvironmentMap().values.flatMap { it.split(File.pathSeparator) }
            .map { File(Paths.get(it, executable).pathString) }.find { it.exists() && it.canExecute() }?.path

    init {
        val nodePath = findExecutableInPATH("node") ?: throw Exception("Could not find node in PATH")

        val lspExecPath = PluginPathManager.getPluginResource(this::class.java, "<%= LanguageName %>LanguageService/main.cjs")?.absolutePath
            ?: throw Exception("Could not find main.cjs")
        val commands: List<String> = mutableListOf(nodePath, lspExecPath, "--stdio")
        super.setCommands(commands)
        super.setWorkingDirectory(project.basePath)
    }
}
