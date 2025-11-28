import os
import lxml.etree as ET

class FdatProcessor:
    def __init__(self, assets_path):
        self.assets_path = assets_path
        self.xsl_path = os.path.join(self.assets_path, 'textchart', 'textchart-to-html.xsl')

    def transform_xml(self, xml_path):
        """
        Parses the XML file at xml_path and applies the XSLT transformation.
        Returns the resulting HTML string.
        """
        try:
            # Load XML
            dom = ET.parse(xml_path)
            return self._apply_transform(dom)
        except Exception as e:
            return f"Error processing file: {str(e)}"

    def transform_xml_content(self, xml_content):
        """
        Parses the XML content string and applies the XSLT transformation.
        Returns the resulting HTML string.
        """
        try:
            # Load XML from string
            # Encode to bytes to avoid encoding issues with lxml
            dom = ET.fromstring(xml_content.encode('utf-8'))
            # Wrap in ElementTree because XSLT expects it or Element
            dom_tree = ET.ElementTree(dom)
            return self._apply_transform(dom_tree)
        except Exception as e:
            return f"Error processing content: {str(e)}"

    def _apply_transform(self, dom):
        # Load XSLT
        if not os.path.exists(self.xsl_path):
            return f"Error: XSLT file not found at {self.xsl_path}"
        
        xslt = ET.parse(self.xsl_path)
        transform = ET.XSLT(xslt)
        
        # Apply transformation
        newdom = transform(dom)
        return str(newdom)
