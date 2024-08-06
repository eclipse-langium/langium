package <%= LanguageName %>.lang

import com.intellij.openapi.application.PluginPathManager
import org.jetbrains.plugins.textmate.api.TextMateBundleProvider
import org.jetbrains.plugins.textmate.api.TextMateBundleProvider.PluginBundle

class <%= LanguageName %>TextMateBundleProvider : TextMateBundleProvider {
    override fun getBundles(): List<PluginBundle> {
        val textmateDir = PluginPathManager.getPluginResource(this::class.java, "textmate") ?: return emptyList()
        val path = textmateDir.toPath()
        return listOf(PluginBundle("<%= LanguageName %>", path))
    }
}
